create table if not exists public.ai_tools (
  key text primary key,
  name text not null unique,
  sort_order smallint not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ai_tools (key, name, sort_order)
values
  ('nano-banana', 'Nano Banana', 1),
  ('doubao', '豆包', 2),
  ('grok', 'Grok', 3),
  ('chatgpt', 'ChatGPT', 4)
on conflict (key) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = true;

create table if not exists public.prompt_ai_tools (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tool_key text not null references public.ai_tools(key),
  created_at timestamptz not null default now(),
  primary key (prompt_id, tool_key)
);

create index if not exists prompt_ai_tools_tool_prompt_idx
  on public.prompt_ai_tools (tool_key, prompt_id);

alter table public.ai_tools enable row level security;
alter table public.prompt_ai_tools enable row level security;

grant select on public.ai_tools to anon, authenticated;
grant select on public.prompt_ai_tools to anon, authenticated;
grant insert, update, delete on public.prompt_ai_tools to authenticated;

create policy "Active AI tools are publicly readable"
  on public.ai_tools for select
  using (active = true);

create policy "Tools for published prompts are publicly readable"
  on public.prompt_ai_tools for select
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and public.prompts.published = true
    )
  );

create policy "Owners and admins can read all relevant prompt tools"
  on public.prompt_ai_tools for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can create prompt tools"
  on public.prompt_ai_tools for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can delete prompt tools"
  on public.prompt_ai_tools for delete
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create or replace function public.create_prompt_with_images(
  p_slug text,
  p_title text,
  p_prompt text,
  p_author_name text,
  p_author_url text,
  p_source_url text,
  p_images jsonb,
  p_is_nsfw boolean,
  p_content_relation text,
  p_tool_keys text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_prompt_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_images) <> 'array'
    or jsonb_array_length(p_images) < 1
    or jsonb_array_length(p_images) > 8 then
    raise exception 'A prompt requires between 1 and 8 images';
  end if;

  if p_content_relation is null
    or p_content_relation not in ('original', 'repost', 'adapted') then
    raise exception 'Invalid content relation';
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
    left join public.ai_tools on public.ai_tools.key = selected.tool_key
    where public.ai_tools.key is null or not public.ai_tools.active
  ) then
    raise exception 'Unknown or inactive verified tool';
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
    published,
    published_at
  )
  values (
    (select auth.uid()),
    p_slug,
    p_title,
    p_prompt,
    p_author_name,
    p_author_url,
    p_source_url,
    coalesce(p_is_nsfw, false),
    p_content_relation,
    true,
    now()
  )
  returning id into new_prompt_id;

  insert into public.prompt_images (
    prompt_id,
    position,
    object_key,
    alt,
    width,
    height
  )
  select
    new_prompt_id,
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

  insert into public.prompt_ai_tools (prompt_id, tool_key)
  select new_prompt_id, tool_key
  from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key);

  return new_prompt_id;
end;
$$;

revoke all on function public.create_prompt_with_images(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  text,
  text[]
) from public;

grant execute on function public.create_prompt_with_images(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  text,
  text[]
) to authenticated;

insert into public.prompt_ai_tools (prompt_id, tool_key)
select id, 'nano-banana'
from public.prompts
where source_url in (
  'https://x.com/stark_nico99/status/1991718646570426763',
  'https://x.com/MansiSanghani1/status/2013550795224961492',
  'https://x.com/akirakudo_ai/status/1992096860765561190',
  'https://x.com/FlorianGallwitz/status/1991796624646091091',
  'https://x.com/songguoxiansen/status/2005822648027091031',
  'https://x.com/AllaAisling/status/2004212035333365763',
  'https://x.com/okknews/status/1992173611520868372',
  'https://x.com/dotey/status/1976485558319722711',
  'https://x.com/VoxcatAI/status/1995497350543110411'
)
on conflict (prompt_id, tool_key) do nothing;
