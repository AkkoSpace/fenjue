do $$
begin
  create type public.prompt_review_status as enum (
    'pending',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.prompts
  add column if not exists review_status public.prompt_review_status
    not null default 'pending',
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid
    references public.profiles(id) on delete set null;

alter table public.prompts
  drop constraint if exists prompts_review_note_length,
  add constraint prompts_review_note_length
    check (review_note is null or char_length(review_note) <= 2000);

-- 本次上线按产品要求将存量内容全部退回审核队列，不删除任何内容或图片。
update public.prompts
set review_status = 'pending',
    review_note = null,
    reviewed_at = null,
    reviewed_by = null,
    published = false,
    published_at = null;

alter table public.prompts
  drop constraint if exists prompts_review_publication_consistency,
  add constraint prompts_review_publication_consistency check (
    (
      review_status = 'approved'
      and published
      and published_at is not null
    )
    or (
      review_status <> 'approved'
      and not published
      and published_at is null
    )
  );

create index if not exists prompts_review_status_created_at_idx
  on public.prompts (review_status, created_at desc);

create index if not exists prompts_pending_review_created_at_idx
  on public.prompts (created_at desc)
  where review_status = 'pending';

create table if not exists public.prompt_reviews (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision public.prompt_review_status not null,
  note text,
  created_at timestamptz not null default now(),
  constraint prompt_reviews_note_length
    check (note is null or char_length(note) <= 2000)
);

create index if not exists prompt_reviews_prompt_created_at_idx
  on public.prompt_reviews (prompt_id, created_at desc);

alter table public.prompt_reviews enable row level security;

revoke all on public.prompt_reviews from anon;
grant select, insert on public.prompt_reviews to authenticated;

drop policy if exists "Admins can read prompt reviews"
  on public.prompt_reviews;
drop policy if exists "Admins can create prompt reviews"
  on public.prompt_reviews;

create policy "Admins can read prompt reviews"
  on public.prompt_reviews for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create prompt reviews"
  on public.prompt_reviews for insert
  to authenticated
  with check (
    (select public.is_admin())
    and reviewer_id = (select auth.uid())
  );

create or replace function public.protect_prompt_review_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select public.is_admin()), false) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Prompt ownership cannot be changed';
  end if;

  -- 普通投稿者每次新建或修改内容都会重新进入审核，不能自行公开。
  new.review_status := 'pending';
  new.review_note := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.published := false;
  new.published_at := null;
  return new;
end;
$$;

drop trigger if exists protect_prompt_review_state
  on public.prompts;

create trigger protect_prompt_review_state
before insert or update on public.prompts
for each row execute function public.protect_prompt_review_state();

revoke all on function public.protect_prompt_review_state() from public;

drop policy if exists "Published prompts are publicly readable"
  on public.prompts;
drop policy if exists "Approved prompts are publicly readable"
  on public.prompts;

create policy "Approved prompts are publicly readable"
  on public.prompts for select
  using (published = true and review_status = 'approved');

drop policy if exists "Images for published prompts are publicly readable"
  on public.prompt_images;
drop policy if exists "Images for approved prompts are publicly readable"
  on public.prompt_images;

create policy "Images for approved prompts are publicly readable"
  on public.prompt_images for select
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and public.prompts.published = true
        and public.prompts.review_status = 'approved'
    )
  );

drop policy if exists "Tools for published prompts are publicly readable"
  on public.prompt_ai_tools;
drop policy if exists "Tools for approved prompts are publicly readable"
  on public.prompt_ai_tools;

create policy "Tools for approved prompts are publicly readable"
  on public.prompt_ai_tools for select
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and public.prompts.published = true
        and public.prompts.review_status = 'approved'
    )
  );

drop policy if exists "Published prompt tags are anonymously readable"
  on public.prompt_tags;
drop policy if exists "Authenticated users can read visible prompt tags"
  on public.prompt_tags;

create policy "Approved prompt tags are anonymously readable"
  on public.prompt_tags for select
  to anon
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and public.prompts.published = true
        and public.prompts.review_status = 'approved'
    )
  );

create policy "Authenticated users can read review-visible prompt tags"
  on public.prompt_tags for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and (
          (
            public.prompts.published = true
            and public.prompts.review_status = 'approved'
          )
          or public.prompts.user_id = (select auth.uid())
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

  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 120
    or nullif(trim(p_prompt), '') is null or char_length(trim(p_prompt)) > 20000
    or nullif(trim(p_author_name), '') is null
    or char_length(trim(p_author_name)) > 80 then
    raise exception 'Invalid prompt content';
  end if;

  if p_author_url !~ '^https?://' or char_length(p_author_url) > 2048
    or p_source_url !~ '^https?://' or char_length(p_source_url) > 2048 then
    raise exception 'Invalid source URL';
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
    review_status,
    published,
    published_at
  )
  values (
    (select auth.uid()),
    p_slug,
    trim(p_title),
    trim(p_prompt),
    trim(p_author_name),
    trim(p_author_url),
    trim(p_source_url),
    coalesce(p_is_nsfw, false),
    p_content_relation,
    p_category_key,
    'pending',
    false,
    null
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

create or replace function public.admin_update_prompt_content(
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
  p_tag_keys text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_published boolean;
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  select prompt.published
  into current_published
  from public.prompts prompt
  where prompt.id = p_id;

  if not found then
    raise exception 'Prompt not found';
  end if;

  return public.admin_update_prompt(
    p_id,
    p_title,
    p_prompt,
    p_author_name,
    p_author_url,
    p_source_url,
    p_images,
    p_is_nsfw,
    p_content_relation,
    p_tool_keys,
    p_category_key,
    p_tag_keys,
    current_published
  );
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
) from authenticated;

revoke all on function public.admin_update_prompt_content(
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
  text[]
) from public;

grant execute on function public.admin_update_prompt_content(
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
  text[]
) to authenticated;

create or replace function public.admin_review_prompt(
  p_id uuid,
  p_decision public.prompt_review_status,
  p_note text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reviewed_slug text;
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  if p_decision is null then
    raise exception 'Review decision is required';
  end if;

  if clean_note is not null and char_length(clean_note) > 2000 then
    raise exception 'Review note is too long';
  end if;

  if p_decision = 'rejected' and clean_note is null then
    raise exception 'A rejection reason is required';
  end if;

  if p_decision = 'approved' and not exists (
    select 1
    from public.prompts prompt
    join public.categories category
      on category.key = prompt.category_key and category.active
    where prompt.id = p_id
      and exists (
        select 1
        from public.prompt_images image
        where image.prompt_id = prompt.id
      )
      and exists (
        select 1
        from public.prompt_tags prompt_tag
        join public.tags tag
          on tag.key = prompt_tag.tag_key and tag.active
        where prompt_tag.prompt_id = prompt.id
      )
  ) then
    raise exception 'Prompt is incomplete and cannot be approved';
  end if;

  update public.prompts
  set review_status = p_decision,
      review_note = case when p_decision = 'rejected' then clean_note else null end,
      reviewed_at = case when p_decision = 'pending' then null else now() end,
      reviewed_by = case
        when p_decision = 'pending' then null
        else (select auth.uid())
      end,
      published = p_decision = 'approved',
      published_at = case
        when p_decision = 'approved' then coalesce(published_at, now())
        else null
      end
  where id = p_id
  returning slug into reviewed_slug;

  if not found then
    raise exception 'Prompt not found';
  end if;

  insert into public.prompt_reviews (
    prompt_id,
    reviewer_id,
    decision,
    note
  )
  values (
    p_id,
    (select auth.uid()),
    p_decision,
    clean_note
  );

  return reviewed_slug;
end;
$$;

revoke all on function public.admin_review_prompt(
  uuid,
  public.prompt_review_status,
  text
) from public;

grant execute on function public.admin_review_prompt(
  uuid,
  public.prompt_review_status,
  text
) to authenticated;

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
      and prompt.review_status = 'approved'
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
      and prompt.review_status = 'approved'
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
      and prompt.review_status = 'approved'
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
     and prompt.review_status = 'approved'
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
     and prompt.review_status = 'approved'
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
grant execute on function public.get_prompt_facets(text, text)
  to anon, authenticated;
