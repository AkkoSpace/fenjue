create table if not exists public.categories (
  key text primary key,
  name text not null unique,
  sort_order smallint not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (key, name, sort_order)
values
  ('portrait', '人像', 1),
  ('photography', '摄影', 2),
  ('illustration', '插画', 3),
  ('graphic-design', '平面设计', 4),
  ('infographic', '信息图表', 5),
  ('environment', '场景空间', 6)
on conflict (key) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = true;

create table if not exists public.tags (
  key text primary key,
  name text not null unique,
  kind text not null check (kind in ('style', 'format', 'theme')),
  sort_order smallint not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tags (key, name, kind, sort_order)
values
  ('realistic', '写实', 'style', 1),
  ('hand-drawn', '手绘', 'style', 2),
  ('minimal', '极简', 'style', 3),
  ('vintage', '复古', 'style', 4),
  ('watercolor', '水彩', 'style', 5),
  ('crayon', '蜡笔', 'style', 6),
  ('ukiyo-e', '浮世绘', 'style', 7),
  ('liquid-glass', '液态玻璃', 'style', 8),
  ('photo-edit', '照片改造', 'format', 9),
  ('poster-cover', '海报封面', 'format', 10),
  ('infographic', '信息图', 'format', 11),
  ('collage', '拼图', 'format', 12),
  ('quote-card', '引言卡', 'format', 13),
  ('map', '地图', 'format', 14),
  ('panorama-360', '360 全景', 'format', 15),
  ('portrait', '人像', 'theme', 16),
  ('travel', '旅行', 'theme', 17),
  ('lifestyle', '生活方式', 'theme', 18),
  ('interior', '室内空间', 'theme', 19),
  ('architecture', '建筑', 'theme', 20),
  ('festival', '节日', 'theme', 21),
  ('technology', '科技', 'theme', 22),
  ('food', '美食', 'theme', 23)
on conflict (key) do update set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  active = true;

alter table public.prompts
  add column if not exists category_key text references public.categories(key);

update public.prompts
set category_key = case slug
  when 'hand-drawn-photo-notes' then 'graphic-design'
  when 'minimal-travel-postcard' then 'graphic-design'
  when 'vr-360-panorama' then 'photography'
  when 'childlike-crayon-drawing' then 'illustration'
  when 'fj-e1ccd3a3f5c64f0e' then 'graphic-design'
  when 'fj-c82000d5c76c4de3' then 'infographic'
  when 'fj-68565779a4d14b07' then 'graphic-design'
  when 'fj-0cf32d282f2a4189' then 'illustration'
  when 'fj-eb432dc1c9754e4a' then 'graphic-design'
  when 'fj-14def24e2c584449' then 'infographic'
  when 'fj-60d45f8201434d38' then 'infographic'
  when 'fj-e7556499a33244c5' then 'photography'
  when 'fj-93fb492917984227' then 'illustration'
  else category_key
end
where category_key is null;

do $$
begin
  if exists (select 1 from public.prompts where category_key is null) then
    raise exception 'Every existing prompt must be classified before this migration can continue';
  end if;
end;
$$;

alter table public.prompts
  alter column category_key set not null;

create index if not exists prompts_category_published_at_idx
  on public.prompts (category_key, published, published_at desc);

create table if not exists public.prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_key text not null references public.tags(key),
  created_at timestamptz not null default now(),
  primary key (prompt_id, tag_key)
);

create index if not exists prompt_tags_tag_prompt_idx
  on public.prompt_tags (tag_key, prompt_id);

insert into public.prompt_tags (prompt_id, tag_key)
select prompts.id, assignments.tag_key
from (
  values
    ('hand-drawn-photo-notes', 'hand-drawn'),
    ('hand-drawn-photo-notes', 'photo-edit'),
    ('hand-drawn-photo-notes', 'lifestyle'),
    ('hand-drawn-photo-notes', 'food'),
    ('minimal-travel-postcard', 'minimal'),
    ('minimal-travel-postcard', 'photo-edit'),
    ('minimal-travel-postcard', 'poster-cover'),
    ('minimal-travel-postcard', 'travel'),
    ('vr-360-panorama', 'realistic'),
    ('vr-360-panorama', 'panorama-360'),
    ('vr-360-panorama', 'travel'),
    ('vr-360-panorama', 'interior'),
    ('childlike-crayon-drawing', 'crayon'),
    ('childlike-crayon-drawing', 'photo-edit'),
    ('childlike-crayon-drawing', 'interior'),
    ('fj-e1ccd3a3f5c64f0e', 'quote-card'),
    ('fj-e1ccd3a3f5c64f0e', 'poster-cover'),
    ('fj-e1ccd3a3f5c64f0e', 'portrait'),
    ('fj-c82000d5c76c4de3', 'liquid-glass'),
    ('fj-c82000d5c76c4de3', 'infographic'),
    ('fj-c82000d5c76c4de3', 'technology'),
    ('fj-68565779a4d14b07', 'hand-drawn'),
    ('fj-68565779a4d14b07', 'photo-edit'),
    ('fj-68565779a4d14b07', 'poster-cover'),
    ('fj-68565779a4d14b07', 'portrait'),
    ('fj-0cf32d282f2a4189', 'watercolor'),
    ('fj-0cf32d282f2a4189', 'map'),
    ('fj-0cf32d282f2a4189', 'travel'),
    ('fj-eb432dc1c9754e4a', 'collage'),
    ('fj-eb432dc1c9754e4a', 'festival'),
    ('fj-eb432dc1c9754e4a', 'poster-cover'),
    ('fj-14def24e2c584449', 'vintage'),
    ('fj-14def24e2c584449', 'infographic'),
    ('fj-14def24e2c584449', 'technology'),
    ('fj-60d45f8201434d38', 'hand-drawn'),
    ('fj-60d45f8201434d38', 'infographic'),
    ('fj-60d45f8201434d38', 'technology'),
    ('fj-e7556499a33244c5', 'realistic'),
    ('fj-e7556499a33244c5', 'portrait'),
    ('fj-e7556499a33244c5', 'interior'),
    ('fj-e7556499a33244c5', 'lifestyle'),
    ('fj-93fb492917984227', 'ukiyo-e'),
    ('fj-93fb492917984227', 'vintage'),
    ('fj-93fb492917984227', 'architecture')
) as assignments(slug, tag_key)
join public.prompts on public.prompts.slug = assignments.slug
on conflict (prompt_id, tag_key) do nothing;

do $$
begin
  if exists (
    select 1
    from public.prompts
    where not exists (
      select 1 from public.prompt_tags
      where public.prompt_tags.prompt_id = public.prompts.id
    )
  ) then
    raise exception 'Every existing prompt must have at least one tag before this migration can continue';
  end if;
end;
$$;

alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.prompt_tags enable row level security;

grant select on public.categories, public.tags, public.prompt_tags to anon, authenticated;
grant insert, delete on public.prompt_tags to authenticated;

create policy "Active categories are publicly readable"
  on public.categories for select
  using (active = true);

create policy "Active tags are publicly readable"
  on public.tags for select
  using (active = true);

create policy "Tags for published prompts are publicly readable"
  on public.prompt_tags for select
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and public.prompts.published = true
    )
  );

create policy "Owners and admins can read all relevant prompt tags"
  on public.prompt_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can create prompt tags"
  on public.prompt_tags for insert
  to authenticated
  with check (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can delete prompt tags"
  on public.prompt_tags for delete
  to authenticated
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

drop function if exists public.create_prompt_with_images(
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
);

create function public.create_prompt_with_images(
  p_slug text,
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
  p_tag_keys text[]
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

  if not exists (
    select 1 from public.categories
    where public.categories.key = p_category_key
      and public.categories.active
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
    left join public.tags on public.tags.key = selected.tag_key
    where public.tags.key is null or not public.tags.active
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
    category_key,
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
    p_category_key,
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

  insert into public.prompt_tags (prompt_id, tag_key)
  select new_prompt_id, tag_key
  from unnest(p_tag_keys) as selected(tag_key);

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
  text[],
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
  text[],
  text,
  text[]
) to authenticated;
