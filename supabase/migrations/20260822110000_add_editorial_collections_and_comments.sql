create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  published boolean not null default false,
  sort_order smallint not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_slug_format check (
    slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'
  ),
  constraint collections_title_length check (
    char_length(trim(title)) between 1 and 80
  ),
  constraint collections_description_length check (
    char_length(description) <= 500
  ),
  constraint collections_sort_order_range check (
    sort_order between 1 and 32767
  )
);

create index collections_public_order_idx
  on public.collections (sort_order, created_at desc)
  where published;

create table public.collection_prompts (
  collection_id uuid not null
    references public.collections(id) on delete cascade,
  prompt_id uuid not null
    references public.prompts(id) on delete cascade,
  position smallint not null default 100,
  created_at timestamptz not null default now(),
  primary key (collection_id, prompt_id),
  constraint collection_prompts_position_range check (
    position between 1 and 32767
  )
);

create index collection_prompts_prompt_idx
  on public.collection_prompts (prompt_id, collection_id);

create index collection_prompts_order_idx
  on public.collection_prompts (collection_id, position, created_at);

create table public.prompt_features (
  prompt_id uuid primary key
    references public.prompts(id) on delete cascade,
  recommendation text not null,
  position smallint not null default 100,
  featured_by uuid references public.profiles(id) on delete set null,
  featured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_features_recommendation_length check (
    char_length(trim(recommendation)) between 2 and 160
  ),
  constraint prompt_features_position_range check (
    position between 1 and 32767
  )
);

create index prompt_features_order_idx
  on public.prompt_features (position, featured_at desc);

create table public.prompt_comments (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null
    references public.prompts(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  author_name text not null,
  body text not null,
  tool_key text references public.ai_tools(key),
  review_status public.prompt_review_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_comments_author_length check (
    char_length(trim(author_name)) between 1 and 50
  ),
  constraint prompt_comments_body_length check (
    char_length(trim(body)) between 10 and 500
  ),
  constraint prompt_comments_review_note_length check (
    review_note is null or char_length(review_note) <= 1000
  )
);

create index prompt_comments_public_idx
  on public.prompt_comments (prompt_id, created_at desc)
  where review_status = 'approved';

create index prompt_comments_review_queue_idx
  on public.prompt_comments (review_status, created_at desc);

create index prompt_comments_user_idx
  on public.prompt_comments (user_id, created_at desc);

create table public.prompt_comment_reviews (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null
    references public.prompt_comments(id) on delete cascade,
  reviewer_id uuid not null
    references public.profiles(id) on delete restrict,
  decision public.prompt_review_status not null,
  note text,
  created_at timestamptz not null default now(),
  constraint prompt_comment_reviews_note_length check (
    note is null or char_length(note) <= 1000
  )
);

create index prompt_comment_reviews_comment_idx
  on public.prompt_comment_reviews (comment_id, created_at desc);

create index prompt_comment_reviews_reviewer_idx
  on public.prompt_comment_reviews (reviewer_id, created_at desc);

alter table public.collections enable row level security;
alter table public.collection_prompts enable row level security;
alter table public.prompt_features enable row level security;
alter table public.prompt_comments enable row level security;
alter table public.prompt_comment_reviews enable row level security;

revoke all on public.collections from anon, authenticated;
revoke all on public.collection_prompts from anon, authenticated;
revoke all on public.prompt_features from anon, authenticated;
revoke all on public.prompt_comments from anon, authenticated;
revoke all on public.prompt_comment_reviews from anon, authenticated;

grant select on public.collections to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
grant select on public.collection_prompts to anon, authenticated;
grant select on public.prompt_features to anon, authenticated;
grant select on public.prompt_comments to anon, authenticated;
grant select on public.prompt_comment_reviews to authenticated;

create policy "Published collections are anonymously readable"
  on public.collections for select
  to anon
  using (published);

create policy "Published collections and admin drafts are authenticated readable"
  on public.collections for select
  to authenticated
  using (published or (select public.is_admin()));

create policy "Admins can create collections"
  on public.collections for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update collections"
  on public.collections for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete collections"
  on public.collections for delete
  to authenticated
  using ((select public.is_admin()));

create policy "Published collection prompts are anonymously readable"
  on public.collection_prompts for select
  to anon
  using (
    exists (
      select 1
      from public.collections collection
      join public.prompts prompt on prompt.id = collection_prompts.prompt_id
      where collection.id = collection_prompts.collection_id
        and collection.published
        and prompt.published
        and prompt.review_status = 'approved'
    )
  );

create policy "Published collection prompts and admin drafts are authenticated readable"
  on public.collection_prompts for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.collections collection
      join public.prompts prompt on prompt.id = collection_prompts.prompt_id
      where collection.id = collection_prompts.collection_id
        and collection.published
        and prompt.published
        and prompt.review_status = 'approved'
    )
  );

create policy "Featured approved prompts are anonymously readable"
  on public.prompt_features for select
  to anon
  using (
    exists (
      select 1
      from public.prompts prompt
      where prompt.id = prompt_features.prompt_id
        and prompt.published
        and prompt.review_status = 'approved'
    )
  );

create policy "Featured approved prompts and admin drafts are authenticated readable"
  on public.prompt_features for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.prompts prompt
      where prompt.id = prompt_features.prompt_id
        and prompt.published
        and prompt.review_status = 'approved'
    )
  );

create policy "Approved comments are anonymously readable"
  on public.prompt_comments for select
  to anon
  using (
    review_status = 'approved'
    and exists (
      select 1
      from public.prompts prompt
      where prompt.id = prompt_comments.prompt_id
        and prompt.published
        and prompt.review_status = 'approved'
    )
  );

create policy "Approved, own and admin comments are authenticated readable"
  on public.prompt_comments for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (
      review_status = 'approved'
      and exists (
        select 1
        from public.prompts prompt
        where prompt.id = prompt_comments.prompt_id
          and prompt.published
          and prompt.review_status = 'approved'
      )
    )
  );

create policy "Admins can read comment review history"
  on public.prompt_comment_reviews for select
  to authenticated
  using ((select public.is_admin()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_editorial_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_editorial_updated_at()
  from public, anon, authenticated;

create trigger touch_collections_updated_at
before update on public.collections
for each row execute function private.touch_editorial_updated_at();

create trigger touch_prompt_features_updated_at
before update on public.prompt_features
for each row execute function private.touch_editorial_updated_at();

create trigger touch_prompt_comments_updated_at
before update on public.prompt_comments
for each row execute function private.touch_editorial_updated_at();

create or replace function public.create_prompt_comment(
  p_slug text,
  p_body text,
  p_tool_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_body text := trim(coalesce(p_body, ''));
  clean_tool_key text := nullif(trim(coalesce(p_tool_key, '')), '');
  comment_id uuid;
  commenter_id uuid := (select auth.uid());
  commenter_name text;
  target_prompt_id uuid;
begin
  if commenter_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(clean_body) < 10 or char_length(clean_body) > 500 then
    raise exception 'Comment length is invalid';
  end if;

  select prompt.id
  into target_prompt_id
  from public.prompts prompt
  where prompt.slug = p_slug
    and prompt.published
    and prompt.review_status = 'approved';

  if target_prompt_id is null then
    raise exception 'Published prompt not found';
  end if;

  if clean_tool_key is not null and not exists (
    select 1
    from public.ai_tools tool
    where tool.key = clean_tool_key
      and tool.active
  ) then
    raise exception 'AI tool is invalid';
  end if;

  select coalesce(nullif(trim(profile.display_name), ''), '焚诀用户')
  into commenter_name
  from public.profiles profile
  where profile.id = commenter_id;

  if commenter_name is null then
    raise exception 'User profile not found';
  end if;

  insert into public.prompt_comments (
    prompt_id,
    user_id,
    author_name,
    body,
    tool_key
  )
  values (
    target_prompt_id,
    commenter_id,
    commenter_name,
    clean_body,
    clean_tool_key
  )
  returning id into comment_id;

  return comment_id;
end;
$$;

create or replace function public.delete_own_prompt_comment(
  p_comment_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_slug text;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.prompt_comments comment
  using public.prompts prompt
  where comment.id = p_comment_id
    and comment.user_id = current_user_id
    and prompt.id = comment.prompt_id
  returning prompt.slug into deleted_slug;

  if deleted_slug is null then
    raise exception 'Comment not found';
  end if;

  return deleted_slug;
end;
$$;

create or replace function public.admin_review_prompt_comment(
  p_comment_id uuid,
  p_decision public.prompt_review_status,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access required';
  end if;

  if p_decision is null then
    raise exception 'Review decision is required';
  end if;

  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Review note is too long';
  end if;

  if p_decision = 'rejected' and clean_note is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.prompt_comments
  set review_status = p_decision,
      review_note = case when p_decision = 'rejected' then clean_note else null end,
      reviewed_by = case
        when p_decision = 'pending' then null
        else (select auth.uid())
      end,
      reviewed_at = case
        when p_decision = 'pending' then null
        else now()
      end
  where id = p_comment_id;

  if not found then
    raise exception 'Comment not found';
  end if;

  insert into public.prompt_comment_reviews (
    comment_id,
    reviewer_id,
    decision,
    note
  )
  values (
    p_comment_id,
    (select auth.uid()),
    p_decision,
    clean_note
  );

  return p_comment_id;
end;
$$;

create or replace function public.admin_set_prompt_editorial(
  p_prompt_id uuid,
  p_featured boolean,
  p_recommendation text,
  p_feature_position integer,
  p_collection_memberships jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_recommendation text := trim(coalesce(p_recommendation, ''));
  memberships jsonb := coalesce(p_collection_memberships, '[]'::jsonb);
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access required';
  end if;

  if not exists (select 1 from public.prompts where id = p_prompt_id) then
    raise exception 'Prompt not found';
  end if;

  if coalesce(p_featured, false) then
    if char_length(clean_recommendation) < 2
      or char_length(clean_recommendation) > 160
      or p_feature_position is null
      or p_feature_position < 1
      or p_feature_position > 32767
    then
      raise exception 'Feature metadata is invalid';
    end if;

    insert into public.prompt_features (
      prompt_id,
      recommendation,
      position,
      featured_by
    )
    values (
      p_prompt_id,
      clean_recommendation,
      p_feature_position,
      (select auth.uid())
    )
    on conflict (prompt_id) do update
    set recommendation = excluded.recommendation,
        position = excluded.position,
        featured_by = excluded.featured_by,
        featured_at = case
          when public.prompt_features.recommendation <> excluded.recommendation
            or public.prompt_features.position <> excluded.position
          then now()
          else public.prompt_features.featured_at
        end;
  else
    delete from public.prompt_features where prompt_id = p_prompt_id;
  end if;

  if jsonb_typeof(memberships) <> 'array'
    or jsonb_array_length(memberships) > 20
  then
    raise exception 'Collection memberships are invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(memberships)
      as item(collection_id uuid, position integer)
    where item.collection_id is null
      or item.position is null
      or item.position < 1
      or item.position > 32767
  ) then
    raise exception 'Collection membership values are invalid';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(memberships)
      as item(collection_id uuid, position integer)
  ) <> (
    select count(distinct item.collection_id)
    from jsonb_to_recordset(memberships)
      as item(collection_id uuid, position integer)
  ) then
    raise exception 'Collection memberships must be unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(memberships)
      as item(collection_id uuid, position integer)
    left join public.collections collection on collection.id = item.collection_id
    where collection.id is null
  ) then
    raise exception 'Collection not found';
  end if;

  delete from public.collection_prompts where prompt_id = p_prompt_id;

  insert into public.collection_prompts (collection_id, prompt_id, position)
  select item.collection_id, p_prompt_id, item.position
  from jsonb_to_recordset(memberships)
    as item(collection_id uuid, position integer);
end;
$$;

revoke all on function public.create_prompt_comment(text, text, text)
  from public;
revoke all on function public.delete_own_prompt_comment(uuid)
  from public;
revoke all on function public.admin_review_prompt_comment(
  uuid,
  public.prompt_review_status,
  text
) from public;
revoke all on function public.admin_set_prompt_editorial(
  uuid,
  boolean,
  text,
  integer,
  jsonb
) from public;

grant execute on function public.create_prompt_comment(text, text, text)
  to authenticated;
grant execute on function public.delete_own_prompt_comment(uuid)
  to authenticated;
grant execute on function public.admin_review_prompt_comment(
  uuid,
  public.prompt_review_status,
  text
) to authenticated;
grant execute on function public.admin_set_prompt_editorial(
  uuid,
  boolean,
  text,
  integer,
  jsonb
) to authenticated;

comment on table public.prompt_features is
  'Current administrator-curated featured prompts with recommendation copy';
comment on table public.collections is
  'Editorial prompt collections with stable public slugs';
comment on table public.prompt_comments is
  'Authenticated user field notes, published only after moderation';
