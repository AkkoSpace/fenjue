-- 上传清理必须先取得对象租约，避免并发投稿重新关联后仍被 R2 删除。

drop function if exists public.request_own_image_cleanup(text[]);

create or replace function public.request_own_image_cleanup(p_object_keys text[])
returns table (object_key text)
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

  return query
  update public.image_uploads upload
  set cleanup_requested_at = now(),
      cleanup_lease_until = now() + interval '15 minutes',
      cleanup_attempts = upload.cleanup_attempts + 1,
      updated_at = now()
  where upload.owner_id = current_user_id
    and upload.object_key = any(coalesce(p_object_keys, array[]::text[]))
    and upload.attached_at is null
    and upload.cleaned_at is null
    and not exists (
      select 1 from public.prompt_images image
      where image.object_key = upload.object_key
    )
    and (
      upload.cleanup_lease_until is null
      or upload.cleanup_lease_until < now()
    )
  returning upload.object_key;
end;
$$;

revoke all on function public.request_own_image_cleanup(text[]) from public;
grant execute on function public.request_own_image_cleanup(text[])
  to authenticated;

create or replace function public.guard_prompt_image_cleanup_lease()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  upload public.image_uploads%rowtype;
begin
  select registered.*
  into upload
  from public.image_uploads registered
  where registered.object_key = new.object_key
  for update;

  if found and upload.cleaned_at is not null then
    raise exception 'Image object was already cleaned';
  end if;

  if found and upload.cleanup_lease_until > now() then
    raise exception 'Image cleanup is in progress';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_prompt_image_cleanup_lease() from public;

drop trigger if exists guard_prompt_image_cleanup_lease
  on public.prompt_images;
create trigger guard_prompt_image_cleanup_lease
before insert or update of object_key on public.prompt_images
for each row execute function public.guard_prompt_image_cleanup_lease();
