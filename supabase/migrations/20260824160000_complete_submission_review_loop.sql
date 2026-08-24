-- 投稿审核闭环：站内通知、投稿者修改重投、R2 上传登记与可重试清理。

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_length
    check (char_length(kind) between 1 and 80),
  constraint notifications_title_length
    check (char_length(title) between 1 and 120),
  constraint notifications_body_length
    check (char_length(body) between 1 and 500),
  constraint notifications_safe_href
    check (href ~ '^/[A-Za-z0-9_/?=&.%-]+$')
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
grant select, update (read_at) on public.notifications to authenticated;

create policy "Users can read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can mark their own notifications as read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_prompt_review_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status is not distinct from old.review_status
    or new.review_status not in ('approved', 'rejected') then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body, href)
  values (
    new.user_id,
    'prompt_review_' || new.review_status::text,
    case
      when new.review_status = 'approved' then '作品已通过审核'
      else '作品需要修改'
    end,
    left(case
      when new.review_status = 'approved'
        then '《' || new.title || '》已经公开展示。'
      else '《' || new.title || '》未通过审核：' || coalesce(new.review_note, '请修改后重新提交。')
    end, 500),
    case
      when new.review_status = 'approved' then '/prompts/' || new.slug
      else '/account/submissions/' || new.id::text || '/edit'
    end
  );

  return new;
end;
$$;

revoke all on function public.notify_prompt_review_result() from public;

drop trigger if exists notify_prompt_review_result on public.prompts;
create trigger notify_prompt_review_result
after update of review_status on public.prompts
for each row execute function public.notify_prompt_review_result();

create table if not exists public.image_uploads (
  object_key text primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  attached_at timestamptz,
  cleanup_requested_at timestamptz,
  cleanup_lease_until timestamptz,
  cleanup_attempts integer not null default 0,
  last_cleanup_error text,
  cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_uploads_safe_object_key check (
    object_key ~ '^prompts/[A-Za-z0-9._/-]+\.(avif|jpe?g|png|webp)$'
    and object_key not like '%..%'
    and object_key not like '%//%'
  ),
  constraint image_uploads_cleanup_attempts_nonnegative
    check (cleanup_attempts >= 0),
  constraint image_uploads_error_length
    check (last_cleanup_error is null or char_length(last_cleanup_error) <= 500)
);

create index if not exists image_uploads_pending_cleanup_idx
  on public.image_uploads (cleanup_requested_at, created_at)
  where cleaned_at is null;

alter table public.image_uploads enable row level security;
revoke all on public.image_uploads from anon, authenticated;

create or replace function public.register_image_upload(p_object_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_object_key !~ (
    '^prompts/' || current_user_id::text ||
    '/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}\.(avif|jpg|png|webp)$'
  ) then
    raise exception 'Invalid image object key';
  end if;

  insert into public.image_uploads (object_key, owner_id)
  values (p_object_key, current_user_id)
  on conflict (object_key) do nothing;
end;
$$;

revoke all on function public.register_image_upload(text) from public;
grant execute on function public.register_image_upload(text) to authenticated;

create or replace function public.request_own_image_cleanup(p_object_keys text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.image_uploads upload
  set cleanup_requested_at = now(),
      cleanup_lease_until = null,
      updated_at = now()
  where upload.owner_id = current_user_id
    and upload.object_key = any(coalesce(p_object_keys, array[]::text[]))
    and upload.attached_at is null
    and upload.cleaned_at is null;
end;
$$;

revoke all on function public.request_own_image_cleanup(text[]) from public;
grant execute on function public.request_own_image_cleanup(text[]) to authenticated;

create or replace function public.sync_prompt_image_upload_registry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_owner_id uuid;
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.object_key is distinct from old.object_key) then
    if not exists (
      select 1 from public.prompt_images image
      where image.object_key = old.object_key
    ) then
      update public.image_uploads
      set attached_at = null,
          cleanup_requested_at = now(),
          cleanup_lease_until = null,
          updated_at = now()
      where object_key = old.object_key
        and cleaned_at is null;
    end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.object_key is distinct from old.object_key) then
    select prompt.user_id
    into image_owner_id
    from public.prompts prompt
    where prompt.id = new.prompt_id;

    insert into public.image_uploads (
      object_key,
      owner_id,
      attached_at,
      cleanup_requested_at,
      cleanup_lease_until,
      last_cleanup_error,
      cleaned_at,
      updated_at
    )
    values (
      new.object_key,
      image_owner_id,
      now(),
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (object_key) do update
    set owner_id = coalesce(excluded.owner_id, public.image_uploads.owner_id),
        attached_at = now(),
        cleanup_requested_at = null,
        cleanup_lease_until = null,
        last_cleanup_error = null,
        cleaned_at = null,
        updated_at = now();
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_prompt_image_upload_registry() from public;

drop trigger if exists sync_prompt_image_upload_registry on public.prompt_images;
create trigger sync_prompt_image_upload_registry
after insert or delete or update of object_key on public.prompt_images
for each row execute function public.sync_prompt_image_upload_registry();

-- 把迁移前已经关联的图片登记为安全的在用对象；不会触发删除。
insert into public.image_uploads (object_key, owner_id, attached_at)
select image.object_key, prompt.user_id, now()
from public.prompt_images image
join public.prompts prompt on prompt.id = image.prompt_id
on conflict (object_key) do update
set owner_id = coalesce(excluded.owner_id, public.image_uploads.owner_id),
    attached_at = now(),
    cleanup_requested_at = null,
    cleanup_lease_until = null,
    cleaned_at = null,
    updated_at = now();

create or replace function public.update_own_prompt_content(
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_slug text;
  current_status public.prompt_review_status;
  removed_keys text[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select prompt.slug, prompt.review_status
  into current_slug, current_status
  from public.prompts prompt
  where prompt.id = p_id
    and prompt.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Prompt not found';
  end if;

  if current_status not in ('pending', 'rejected') then
    raise exception 'Only pending or rejected prompts can be edited';
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
    select 1 from public.categories category
    where category.key = p_category_key and category.active
  ) then
    raise exception 'Unknown or inactive category';
  end if;

  if coalesce(cardinality(p_tag_keys), 0) < 1
    or cardinality(p_tag_keys) > 6
    or array_position(p_tag_keys, null) is not null
    or (
      select count(*) <> count(distinct tag_key)
      from unnest(coalesce(p_tag_keys, array[]::text[])) selected(tag_key)
    )
    or exists (
      select 1
      from unnest(p_tag_keys) selected(tag_key)
      left join public.tags tag on tag.key = selected.tag_key
      where tag.key is null or not tag.active
    ) then
    raise exception 'Invalid tags';
  end if;

  if coalesce(cardinality(p_tool_keys), 0) > 4
    or array_position(p_tool_keys, null) is not null
    or (
      select count(*) <> count(distinct tool_key)
      from unnest(coalesce(p_tool_keys, array[]::text[])) selected(tool_key)
    )
    or exists (
      select 1
      from unnest(coalesce(p_tool_keys, array[]::text[])) selected(tool_key)
      left join public.ai_tools tool on tool.key = selected.tool_key
      where tool.key is null
        or (
          not tool.active
          and not exists (
            select 1 from public.prompt_ai_tools current_tool
            where current_tool.prompt_id = p_id
              and current_tool.tool_key = selected.tool_key
          )
        )
    ) then
    raise exception 'Invalid verified tools';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_images) image(
      position smallint,
      object_key text,
      alt text,
      width integer,
      height integer
    )
    where image.position is null or image.position < 1
      or image.object_key is null
      or char_length(image.object_key) > 512
      or image.object_key !~ '\.(avif|jpe?g|png|webp)$'
      or (
        not exists (
          select 1 from public.prompt_images current_image
          where current_image.prompt_id = p_id
            and current_image.object_key = image.object_key
        )
        and image.object_key !~ (
          '^prompts/' || current_user_id::text ||
          '/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}\.(avif|jpg|png|webp)$'
        )
      )
      or image.alt is null or char_length(image.alt) > 240
      or image.width is null or image.width < 1 or image.width > 12000
      or image.height is null or image.height < 1 or image.height > 12000
  ) then
    raise exception 'Invalid prompt images';
  end if;

  if (
    select count(*) <> count(distinct image.position)
      or count(*) <> count(distinct image.object_key)
      or min(image.position) <> 1
      or max(image.position) <> count(*)
    from jsonb_to_recordset(p_images) image(position smallint, object_key text)
  ) then
    raise exception 'Invalid prompt image order';
  end if;

  select coalesce(array_agg(image.object_key order by image.position), array[]::text[])
  into removed_keys
  from public.prompt_images image
  where image.prompt_id = p_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_images) next_image(object_key text)
      where next_image.object_key = image.object_key
    );

  update public.prompts
  set title = trim(p_title),
      prompt = trim(p_prompt),
      author_name = trim(p_author_name),
      author_url = trim(p_author_url),
      source_url = trim(p_source_url),
      is_nsfw = coalesce(p_is_nsfw, false),
      content_relation = p_content_relation,
      category_key = p_category_key,
      review_status = 'pending',
      review_note = null,
      reviewed_at = null,
      reviewed_by = null,
      published = false,
      published_at = null
  where id = p_id;

  delete from public.prompt_images where prompt_id = p_id;
  insert into public.prompt_images (prompt_id, position, object_key, alt, width, height)
  select p_id, image.position, image.object_key, image.alt, image.width, image.height
  from jsonb_to_recordset(p_images) image(
    position smallint,
    object_key text,
    alt text,
    width integer,
    height integer
  );

  delete from public.prompt_ai_tools where prompt_id = p_id;
  insert into public.prompt_ai_tools (prompt_id, tool_key)
  select p_id, tool_key
  from unnest(coalesce(p_tool_keys, array[]::text[])) selected(tool_key);

  delete from public.prompt_tags where prompt_id = p_id;
  insert into public.prompt_tags (prompt_id, tag_key)
  select p_id, tag_key from unnest(p_tag_keys) selected(tag_key);

  return jsonb_build_object(
    'slug', current_slug,
    'removed_object_keys', to_jsonb(removed_keys)
  );
end;
$$;

revoke all on function public.update_own_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[]
) from public;
grant execute on function public.update_own_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[]
) to authenticated;

create or replace function public.claim_image_cleanup_jobs(
  p_limit integer default 100,
  p_grace_hours integer default 24,
  p_lease_seconds integer default 900
)
returns table (object_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 500
    or p_grace_hours < 1 or p_grace_hours > 168
    or p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'Invalid cleanup limits';
  end if;

  return query
  with candidates as (
    select upload.object_key
    from public.image_uploads upload
    where upload.cleaned_at is null
      and upload.attached_at is null
      and not exists (
        select 1 from public.prompt_images image
        where image.object_key = upload.object_key
      )
      and (
        upload.cleanup_requested_at <= now()
        or (
          upload.cleanup_requested_at is null
          and upload.created_at < now() - make_interval(hours => p_grace_hours)
        )
      )
      and (
        upload.cleanup_lease_until is null
        or upload.cleanup_lease_until < now()
      )
    order by coalesce(upload.cleanup_requested_at, upload.created_at)
    for update skip locked
    limit p_limit
  )
  update public.image_uploads upload
  set cleanup_lease_until = now() + make_interval(secs => p_lease_seconds),
      cleanup_attempts = upload.cleanup_attempts + 1,
      updated_at = now()
  from candidates
  where upload.object_key = candidates.object_key
  returning upload.object_key;
end;
$$;

create or replace function public.complete_image_cleanup(p_object_keys text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.image_uploads
  set cleaned_at = now(),
      cleanup_lease_until = null,
      last_cleanup_error = null,
      updated_at = now()
  where object_key = any(coalesce(p_object_keys, array[]::text[]))
    and attached_at is null;
$$;

create or replace function public.fail_image_cleanup(
  p_object_keys text[],
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.image_uploads
  set cleanup_requested_at = now() + interval '6 hours',
      cleanup_lease_until = null,
      last_cleanup_error = left(coalesce(p_error, 'Unknown cleanup error'), 500),
      updated_at = now()
  where object_key = any(coalesce(p_object_keys, array[]::text[]))
    and cleaned_at is null;
$$;

revoke all on function public.claim_image_cleanup_jobs(integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_image_cleanup(text[])
  from public, anon, authenticated;
revoke all on function public.fail_image_cleanup(text[], text)
  from public, anon, authenticated;

grant execute on function public.claim_image_cleanup_jobs(integer, integer, integer)
  to service_role;
grant execute on function public.complete_image_cleanup(text[])
  to service_role;
grant execute on function public.fail_image_cleanup(text[], text)
  to service_role;

create or replace function public.admin_get_image_cleanup_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  return (
    select jsonb_build_object(
      'registered_objects', count(*) filter (
        where upload.attached_at is not null and upload.cleaned_at is null
      ),
      'pending_cleanup', count(*) filter (
        where upload.attached_at is null and upload.cleaned_at is null
      ),
      'failed_cleanup', count(*) filter (
        where upload.attached_at is null
          and upload.cleaned_at is null
          and upload.last_cleanup_error is not null
      ),
      'oldest_pending_at', min(upload.created_at) filter (
        where upload.attached_at is null and upload.cleaned_at is null
      )
    )
    from public.image_uploads upload
  );
end;
$$;

revoke all on function public.admin_get_image_cleanup_overview() from public;
grant execute on function public.admin_get_image_cleanup_overview()
  to authenticated;
