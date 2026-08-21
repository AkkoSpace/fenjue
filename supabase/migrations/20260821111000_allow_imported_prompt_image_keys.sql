create or replace function public.admin_update_prompt(
  p_id uuid,
  p_title text,
  p_prompt text,
  p_author_name text,
  p_author_url text,
  p_source_url text,
  p_images jsonb,
  p_is_nsfw boolean,
  p_content_relation text,
  p_tool_keys text[],
  p_category_key text,
  p_tag_keys text[],
  p_published boolean
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_published boolean;
  current_published_at timestamptz;
  old_object_keys text[];
  removed_object_keys text[];
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  select prompt.published, prompt.published_at
  into current_published, current_published_at
  from public.prompts prompt
  where prompt.id = p_id;

  if not found then
    raise exception 'Prompt not found';
  end if;

  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 120 then
    raise exception 'Invalid title';
  end if;

  if nullif(trim(p_prompt), '') is null or char_length(trim(p_prompt)) > 20000 then
    raise exception 'Invalid prompt';
  end if;

  if nullif(trim(p_author_name), '') is null
    or char_length(trim(p_author_name)) > 80 then
    raise exception 'Invalid author name';
  end if;

  if p_author_url !~ '^https?://' or char_length(p_author_url) > 2048
    or p_source_url !~ '^https?://' or char_length(p_source_url) > 2048 then
    raise exception 'Invalid source URL';
  end if;

  if p_content_relation not in ('original', 'repost', 'adapted') then
    raise exception 'Invalid content relation';
  end if;

  if jsonb_typeof(p_images) <> 'array'
    or jsonb_array_length(p_images) < 1
    or jsonb_array_length(p_images) > 8 then
    raise exception 'A prompt requires between 1 and 8 images';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_images) as image(
      position integer,
      object_key text,
      alt text,
      width integer,
      height integer
    )
    where image.position is null
      or image.position < 1
      or image.position > 8
      or image.object_key is null
      or image.object_key !~ '^prompts/[A-Za-z0-9._/-]+\.(avif|jpe?g|png|webp)$'
      or image.object_key like '%..%'
      or image.object_key like '%//%'
      or char_length(image.object_key) > 512
      or image.alt is null
      or char_length(image.alt) > 240
      or image.width is null
      or image.height is null
      or image.width < 1
      or image.height < 1
      or image.width > 12000
      or image.height > 12000
  ) then
    raise exception 'Invalid image metadata';
  end if;

  if (
    select count(*) <> count(distinct image.position)
      or count(*) <> count(distinct image.object_key)
      or min(image.position) <> 1
      or max(image.position) <> count(*)
    from jsonb_to_recordset(p_images) as image(
      position integer,
      object_key text
    )
  ) then
    raise exception 'Invalid image order';
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.key = p_category_key
      and category.active
  ) then
    raise exception 'Unknown or inactive category';
  end if;

  if coalesce(cardinality(p_tag_keys), 0) < 1
    or cardinality(p_tag_keys) > 6
    or array_position(p_tag_keys, null) is not null
    or (
      select count(*) <> count(distinct tag_key)
      from unnest(coalesce(p_tag_keys, array[]::text[])) as selected(tag_key)
    ) then
    raise exception 'Invalid tags';
  end if;

  if exists (
    select 1
    from unnest(p_tag_keys) as selected(tag_key)
    left join public.tags tag on tag.key = selected.tag_key
    where tag.key is null or not tag.active
  ) then
    raise exception 'Unknown or inactive tag';
  end if;

  if coalesce(cardinality(p_tool_keys), 0) > 4
    or array_position(p_tool_keys, null) is not null
    or (
      select count(*) <> count(distinct tool_key)
      from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key)
    ) then
    raise exception 'Invalid verified tools';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key)
    left join public.ai_tools tool on tool.key = selected.tool_key
    where tool.key is null or not tool.active
  ) then
    raise exception 'Unknown or inactive verified tool';
  end if;

  select coalesce(array_agg(image.object_key), array[]::text[])
  into old_object_keys
  from public.prompt_images image
  where image.prompt_id = p_id;

  update public.prompts
  set title = trim(p_title),
      prompt = trim(p_prompt),
      author_name = trim(p_author_name),
      author_url = trim(p_author_url),
      source_url = trim(p_source_url),
      is_nsfw = coalesce(p_is_nsfw, false),
      content_relation = p_content_relation,
      category_key = p_category_key,
      published = coalesce(p_published, false),
      published_at = case
        when not coalesce(p_published, false) then null
        when current_published then current_published_at
        else now()
      end,
      import_status = case
        when import_status is null then null
        else 'ready'
      end,
      import_note = case
        when import_status is null then import_note
        else null
      end
  where id = p_id;

  delete from public.prompt_images where prompt_id = p_id;

  insert into public.prompt_images (
    prompt_id,
    position,
    object_key,
    alt,
    width,
    height
  )
  select
    p_id,
    image.position,
    image.object_key,
    image.alt,
    image.width,
    image.height
  from jsonb_to_recordset(p_images) as image(
    position smallint,
    object_key text,
    alt text,
    width integer,
    height integer
  );

  delete from public.prompt_ai_tools where prompt_id = p_id;
  insert into public.prompt_ai_tools (prompt_id, tool_key)
  select p_id, selected.tool_key
  from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key);

  delete from public.prompt_tags where prompt_id = p_id;
  insert into public.prompt_tags (prompt_id, tag_key)
  select p_id, selected.tag_key
  from unnest(p_tag_keys) as selected(tag_key);

  select coalesce(array_agg(old_key), array[]::text[])
  into removed_object_keys
  from unnest(old_object_keys) as previous(old_key)
  where not exists (
    select 1
    from jsonb_to_recordset(p_images) as image(object_key text)
    where image.object_key = previous.old_key
  );

  return removed_object_keys;
end;
$$;

revoke all on function public.admin_update_prompt(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  text,
  text[],
  text,
  text[],
  boolean
) from public;

grant execute on function public.admin_update_prompt(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  text,
  text[],
  text,
  text[],
  boolean
) to authenticated;
