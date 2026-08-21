drop policy if exists "Tags for published prompts are publicly readable"
  on public.prompt_tags;

drop policy if exists "Owners and admins can read all relevant prompt tags"
  on public.prompt_tags;

create policy "Published prompt tags are anonymously readable"
  on public.prompt_tags for select
  to anon
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and public.prompts.published = true
    )
  );

create policy "Authenticated users can read visible prompt tags"
  on public.prompt_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_tags.prompt_id
        and (
          public.prompts.published = true
          or public.prompts.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );
