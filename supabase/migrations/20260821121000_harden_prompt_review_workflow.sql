create index if not exists prompts_reviewed_by_idx
  on public.prompts (reviewed_by)
  where reviewed_by is not null;

create index if not exists prompt_reviews_reviewer_id_idx
  on public.prompt_reviews (reviewer_id);

drop policy if exists "Approved prompts are publicly readable"
  on public.prompts;
drop policy if exists "Owners and admins can read all relevant prompts"
  on public.prompts;

create policy "Approved prompts are anonymously readable"
  on public.prompts for select
  to anon
  using (published = true and review_status = 'approved');

create policy "Authenticated users can read review-visible prompts"
  on public.prompts for select
  to authenticated
  using (
    (published = true and review_status = 'approved')
    or user_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists "Images for approved prompts are publicly readable"
  on public.prompt_images;
drop policy if exists "Owners and admins can read all relevant prompt images"
  on public.prompt_images;

create policy "Images for approved prompts are anonymously readable"
  on public.prompt_images for select
  to anon
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and public.prompts.published = true
        and public.prompts.review_status = 'approved'
    )
  );

create policy "Authenticated users can read review-visible prompt images"
  on public.prompt_images for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_images.prompt_id
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

drop policy if exists "Tools for approved prompts are publicly readable"
  on public.prompt_ai_tools;
drop policy if exists "Owners and admins can read all relevant prompt tools"
  on public.prompt_ai_tools;

create policy "Tools for approved prompts are anonymously readable"
  on public.prompt_ai_tools for select
  to anon
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
        and public.prompts.published = true
        and public.prompts.review_status = 'approved'
    )
  );

create policy "Authenticated users can read review-visible prompt tools"
  on public.prompt_ai_tools for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts
      where public.prompts.id = prompt_ai_tools.prompt_id
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

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter function public.admin_update_prompt(
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
) set schema private;

revoke all on function private.admin_update_prompt(
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
) from public, anon;

grant execute on function private.admin_update_prompt(
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
security invoker
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

  return private.admin_update_prompt(
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
