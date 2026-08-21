alter table public.prompts
  add column if not exists import_source text,
  add column if not exists external_id text,
  add column if not exists source_description text,
  add column if not exists source_published_at timestamptz,
  add column if not exists import_status text,
  add column if not exists import_note text;

alter table public.prompts
  drop constraint if exists prompts_import_identity_pair,
  add constraint prompts_import_identity_pair
    check ((import_source is null) = (external_id is null)),
  drop constraint if exists prompts_import_status_check,
  add constraint prompts_import_status_check
    check (import_status is null or import_status in ('ready', 'missing_media', 'needs_review'));

create unique index if not exists prompts_import_identity_idx
  on public.prompts (import_source, external_id)
  where import_source is not null and external_id is not null;

create index if not exists prompts_source_published_at_idx
  on public.prompts (source_published_at desc)
  where source_published_at is not null;

insert into public.tags (key, name, kind, sort_order)
values
  ('cinematic', '电影感', 'style', 24),
  ('three-d', '3D', 'style', 25),
  ('anime', '动漫', 'style', 26),
  ('macro', '微距', 'format', 27),
  ('fashion', '时尚', 'theme', 28),
  ('character', '角色', 'theme', 29),
  ('nature', '自然', 'theme', 30),
  ('product', '产品', 'theme', 31)
on conflict (key) do update set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  active = true;

create or replace function public.get_prompt_facets(
  p_category_key text default null,
  p_tag_key text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  filtered_total as (
    select count(*)::integer as value
    from public.prompts prompt
    where prompt.published
      and (p_category_key is null or prompt.category_key = p_category_key)
      and (
        p_tag_key is null
        or exists (
          select 1
          from public.prompt_tags selected_tag
          where selected_tag.prompt_id = prompt.id
            and selected_tag.tag_key = p_tag_key
        )
      )
  ),
  category_total as (
    select count(*)::integer as value
    from public.prompts prompt
    where prompt.published
      and (
        p_tag_key is null
        or exists (
          select 1
          from public.prompt_tags selected_tag
          where selected_tag.prompt_id = prompt.id
            and selected_tag.tag_key = p_tag_key
        )
      )
  ),
  tag_total as (
    select count(*)::integer as value
    from public.prompts prompt
    where prompt.published
      and (p_category_key is null or prompt.category_key = p_category_key)
  ),
  category_counts as (
    select
      category.key,
      category.name,
      category.sort_order,
      count(prompt.id)::integer as count
    from public.categories category
    join public.prompts prompt
      on prompt.category_key = category.key
     and prompt.published
    where category.active
      and (
        p_tag_key is null
        or exists (
          select 1
          from public.prompt_tags selected_tag
          where selected_tag.prompt_id = prompt.id
            and selected_tag.tag_key = p_tag_key
        )
      )
    group by category.key, category.name, category.sort_order
    order by category.sort_order
  ),
  tag_counts as (
    select
      tag.key,
      tag.name,
      tag.sort_order,
      count(distinct prompt.id)::integer as count
    from public.tags tag
    join public.prompt_tags prompt_tag on prompt_tag.tag_key = tag.key
    join public.prompts prompt
      on prompt.id = prompt_tag.prompt_id
     and prompt.published
    where tag.active
      and (p_category_key is null or prompt.category_key = p_category_key)
    group by tag.key, tag.name, tag.sort_order
    order by tag.sort_order
  )
  select jsonb_build_object(
    'filteredCount', (select value from filtered_total),
    'categoryAllCount', (select value from category_total),
    'tagAllCount', (select value from tag_total),
    'categories', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', key,
            'name', name,
            'sortOrder', sort_order,
            'count', count
          ) order by sort_order
        )
        from category_counts
      ),
      '[]'::jsonb
    ),
    'tags', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', key,
            'name', name,
            'sortOrder', sort_order,
            'count', count
          ) order by sort_order
        )
        from tag_counts
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_prompt_facets(text, text) from public;
grant execute on function public.get_prompt_facets(text, text) to anon, authenticated;
