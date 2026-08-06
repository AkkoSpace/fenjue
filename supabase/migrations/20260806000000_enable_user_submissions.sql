alter table public.prompts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

update public.prompts
set user_id = (
  select id
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1
)
where user_id is null;

create index if not exists prompts_user_id_created_at_idx
  on public.prompts (user_id, created_at desc);

drop policy if exists "Published prompts are publicly readable" on public.prompts;
drop policy if exists "Images for published prompts are publicly readable" on public.prompt_images;
drop policy if exists "Admins can create prompts" on public.prompts;
drop policy if exists "Admins can update prompts" on public.prompts;
drop policy if exists "Admins can delete prompts" on public.prompts;
drop policy if exists "Admins can manage prompt images" on public.prompt_images;

create policy "Published prompts are publicly readable"
  on public.prompts for select
  using (published = true);

create policy "Owners and admins can read all relevant prompts"
  on public.prompts for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Authenticated users can create owned prompts"
  on public.prompts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners and admins can update prompts"
  on public.prompts for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Owners and admins can delete prompts"
  on public.prompts for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Images for published prompts are publicly readable"
  on public.prompt_images for select
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and public.prompts.published = true
    )
  );

create policy "Owners and admins can read all relevant prompt images"
  on public.prompt_images for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can create prompt images"
  on public.prompt_images for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can update prompt images"
  on public.prompt_images for update
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and (
          public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create policy "Owners and admins can delete prompt images"
  on public.prompt_images for delete
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
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
  p_images jsonb
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

  insert into public.prompts (
    user_id,
    slug,
    title,
    prompt,
    author_name,
    author_url,
    source_url,
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
  jsonb
) from public;

grant execute on function public.create_prompt_with_images(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
