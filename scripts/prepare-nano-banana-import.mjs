import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const adminId = process.argv[2]?.trim();
if (!/^[0-9a-f-]{36}$/i.test(adminId ?? "")) {
  throw new Error("请传入唯一超管的 UUID。");
}

const secret = randomBytes(32).toString("hex");
const secretHash = createHash("sha256").update(secret).digest("hex");
const runtimeDir = resolve(".r2-upload", "nano-banana-import");
await mkdir(runtimeDir, { recursive: true });

await writeFile(
  resolve(".env.import.local"),
  `NANO_BANANA_IMPORT_SECRET=${secret}\nNANO_BANANA_IMPORT_USER_ID=${adminId}\n`,
  { encoding: "utf8", mode: 0o600 },
);

const sql = `
create or replace function public.import_nano_banana_status(
  p_secret text,
  p_external_ids text[]
)
returns table (external_id text, import_status text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> '${secretHash}' then
    raise exception 'Invalid import secret';
  end if;

  return query
  select prompt.external_id, prompt.import_status
  from public.prompts prompt
  where prompt.import_source = 'youmind-nano-banana-pro-20260802'
    and prompt.external_id = any(coalesce(p_external_ids, array[]::text[]));
end;
$function$;

create or replace function public.import_nano_banana_batch(
  p_secret text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  admin_id uuid;
  item jsonb;
  new_prompt_id uuid;
  record_count integer := 0;
  selected_tags text[];
begin
  if encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> '${secretHash}' then
    raise exception 'Invalid import secret';
  end if;

  if jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) < 1
    or jsonb_array_length(p_records) > 20 then
    raise exception 'A batch requires between 1 and 20 records';
  end if;

  select profile.id into admin_id
  from public.profiles profile
  where profile.is_super_admin
  limit 1;

  if admin_id is null or admin_id <> '${adminId}'::uuid then
    raise exception 'Expected super admin is unavailable';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    if coalesce(item ->> 'external_id', '') = ''
      or coalesce(item ->> 'title', '') = ''
      or coalesce(item ->> 'prompt', '') = ''
      or coalesce(item ->> 'author_name', '') = ''
      or coalesce(item ->> 'author_url', '') = ''
      or coalesce(item ->> 'source_url', '') = ''
      or coalesce(item ->> 'category_key', '') = ''
      or coalesce(item ->> 'import_status', '') not in ('ready', 'missing_media', 'needs_review') then
      raise exception 'Invalid import record';
    end if;

    if jsonb_typeof(item -> 'images') <> 'array'
      or jsonb_array_length(item -> 'images') > 8 then
      raise exception 'Invalid import images';
    end if;

    if item ->> 'import_status' = 'ready'
      and jsonb_array_length(item -> 'images') < 1 then
      raise exception 'A ready record requires an image';
    end if;

    select array_agg(value order by value)
    into selected_tags
    from jsonb_array_elements_text(item -> 'tag_keys');

    if coalesce(cardinality(selected_tags), 0) < 1
      or cardinality(selected_tags) > 6
      or exists (
        select 1
        from unnest(selected_tags) selected(tag_key)
        left join public.tags tag on tag.key = selected.tag_key and tag.active
        where tag.key is null
      ) then
      raise exception 'Invalid import tags';
    end if;

    if not exists (
      select 1 from public.categories category
      where category.key = item ->> 'category_key' and category.active
    ) then
      raise exception 'Invalid import category';
    end if;

    insert into public.prompts (
      user_id,
      slug,
      title,
      prompt,
      author_name,
      author_url,
      source_url,
      is_nsfw,
      content_relation,
      category_key,
      published,
      published_at,
      import_source,
      external_id,
      source_description,
      source_published_at,
      import_status,
      import_note
    )
    values (
      admin_id,
      'fj-nbp-' || (item ->> 'external_id'),
      item ->> 'title',
      item ->> 'prompt',
      item ->> 'author_name',
      item ->> 'author_url',
      item ->> 'source_url',
      false,
      'repost',
      item ->> 'category_key',
      item ->> 'import_status' = 'ready',
      case
        when item ->> 'import_status' = 'ready'
          then coalesce((item ->> 'source_published_at')::timestamptz, now())
        else null
      end,
      'youmind-nano-banana-pro-20260802',
      item ->> 'external_id',
      nullif(item ->> 'source_description', ''),
      nullif(item ->> 'source_published_at', '')::timestamptz,
      item ->> 'import_status',
      nullif(item ->> 'import_note', '')
    )
    on conflict (import_source, external_id)
      where import_source is not null and external_id is not null
    do update set
      title = excluded.title,
      prompt = excluded.prompt,
      author_name = excluded.author_name,
      author_url = excluded.author_url,
      source_url = excluded.source_url,
      category_key = excluded.category_key,
      published = excluded.published,
      published_at = excluded.published_at,
      source_description = excluded.source_description,
      source_published_at = excluded.source_published_at,
      import_status = excluded.import_status,
      import_note = excluded.import_note
    returning id into new_prompt_id;

    delete from public.prompt_images where prompt_id = new_prompt_id;
    insert into public.prompt_images (
      prompt_id, position, object_key, alt, width, height
    )
    select
      new_prompt_id,
      image.position,
      image.object_key,
      image.alt,
      image.width,
      image.height
    from jsonb_to_recordset(item -> 'images') as image(
      position smallint,
      object_key text,
      alt text,
      width integer,
      height integer
    );

    delete from public.prompt_tags where prompt_id = new_prompt_id;
    insert into public.prompt_tags (prompt_id, tag_key)
    select new_prompt_id, tag_key
    from unnest(selected_tags) selected(tag_key);

    insert into public.prompt_ai_tools (prompt_id, tool_key)
    values (new_prompt_id, 'nano-banana')
    on conflict (prompt_id, tool_key) do nothing;

    record_count := record_count + 1;
  end loop;

  return jsonb_build_object('imported', record_count);
end;
$function$;

revoke all on function public.import_nano_banana_status(text, text[]) from public;
revoke all on function public.import_nano_banana_batch(text, jsonb) from public;
grant execute on function public.import_nano_banana_status(text, text[]) to anon;
grant execute on function public.import_nano_banana_batch(text, jsonb) to anon;
`;

await writeFile(resolve(runtimeDir, "create-rpc.sql"), sql, "utf8");
await writeFile(
  resolve(runtimeDir, "drop-rpc.sql"),
  `revoke all on function public.import_nano_banana_status(text, text[]) from public;\nrevoke all on function public.import_nano_banana_batch(text, jsonb) from public;\ndrop function if exists public.import_nano_banana_status(text, text[]);\ndrop function if exists public.import_nano_banana_batch(text, jsonb);\n`,
  "utf8",
);

console.log("一次性导入密钥与 RPC SQL 已写入被忽略的本地运行目录。");
