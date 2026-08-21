drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Users read themselves and admins read all profiles"
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select public.is_admin())
  );

drop policy if exists "Active categories are publicly readable" on public.categories;
drop policy if exists "Admins can read all categories" on public.categories;

create policy "Active categories are anonymously readable"
  on public.categories for select
  to anon
  using (active = true);

create policy "Active categories and all admin categories are readable"
  on public.categories for select
  to authenticated
  using (
    active = true
    or (select public.is_admin())
  );

drop policy if exists "Active tags are publicly readable" on public.tags;
drop policy if exists "Admins can read all tags" on public.tags;

create policy "Active tags are anonymously readable"
  on public.tags for select
  to anon
  using (active = true);

create policy "Active tags and all admin tags are readable"
  on public.tags for select
  to authenticated
  using (
    active = true
    or (select public.is_admin())
  );
