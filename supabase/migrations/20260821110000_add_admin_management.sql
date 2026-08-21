alter table public.categories
  add column if not exists updated_at timestamptz not null default now();

alter table public.tags
  add column if not exists updated_at timestamptz not null default now();

alter table public.categories
  drop constraint if exists categories_sort_order_key;

alter table public.tags
  drop constraint if exists tags_sort_order_key;

create index if not exists categories_sort_order_idx
  on public.categories (sort_order, key);

create index if not exists tags_sort_order_idx
  on public.tags (sort_order, key);

grant insert, update on public.categories, public.tags to authenticated;

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can read all categories"
  on public.categories for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create categories"
  on public.categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update categories"
  on public.categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can read all tags"
  on public.tags for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create tags"
  on public.tags for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update tags"
  on public.tags for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.admin_list_users(
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  role public.app_role,
  is_super_admin boolean,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    auth_user.id,
    auth_user.email::text,
    profile.display_name,
    profile.role,
    profile.is_super_admin,
    auth_user.email_confirmed_at,
    auth_user.last_sign_in_at,
    auth_user.created_at,
    count(*) over() as total_count
  from auth.users auth_user
  join public.profiles profile on profile.id = auth_user.id
  where nullif(trim(coalesce(p_search, '')), '') is null
    or auth_user.email ilike '%' || trim(p_search) || '%'
    or coalesce(profile.display_name, '') ilike '%' || trim(p_search) || '%'
  order by auth_user.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_users(text, integer, integer) from public;
grant execute on function public.admin_list_users(text, integer, integer)
  to authenticated;

create or replace function public.admin_get_taxonomy()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'categories', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', category_item.key,
            'name', category_item.name,
            'sortOrder', category_item.sort_order,
            'active', category_item.active,
            'usageCount', category_item.usage_count,
            'publishedCount', category_item.published_count
          ) order by category_item.sort_order, category_item.key
        )
        from (
          select
            category.key,
            category.name,
            category.sort_order,
            category.active,
            count(prompt.id) as usage_count,
            count(prompt.id) filter (where prompt.published) as published_count
          from public.categories category
          left join public.prompts prompt on prompt.category_key = category.key
          group by category.key, category.name, category.sort_order, category.active
        ) category_item
      ),
      '[]'::jsonb
    ),
    'tags', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', tag_item.key,
            'name', tag_item.name,
            'kind', tag_item.kind,
            'sortOrder', tag_item.sort_order,
            'active', tag_item.active,
            'usageCount', tag_item.usage_count,
            'publishedCount', tag_item.published_count
          ) order by tag_item.sort_order, tag_item.key
        )
        from (
          select
            tag.key,
            tag.name,
            tag.kind,
            tag.sort_order,
            tag.active,
            count(distinct prompt_tag.prompt_id) as usage_count,
            count(distinct prompt_tag.prompt_id)
              filter (where prompt.published) as published_count
          from public.tags tag
          left join public.prompt_tags prompt_tag on prompt_tag.tag_key = tag.key
          left join public.prompts prompt on prompt.id = prompt_tag.prompt_id
          group by tag.key, tag.name, tag.kind, tag.sort_order, tag.active
        ) tag_item
      ),
      '[]'::jsonb
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_taxonomy() from public;
grant execute on function public.admin_get_taxonomy() to authenticated;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_super_admin
  ) then
    raise exception 'Super administrator access required';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_user_id
      and is_super_admin
  ) then
    raise exception 'The super administrator role is immutable';
  end if;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role)
  from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role)
  to authenticated;

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
      or image.object_key !~ '^prompts/[0-9a-f-]+/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]+\\.(avif|jpg|png|webp)$'
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
