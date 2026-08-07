create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  role public.app_role not null default 'user',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_super_admin_requires_admin
    check (not is_super_admin or role = 'admin')
);

create unique index profiles_single_super_admin_idx
  on public.profiles (is_super_admin)
  where is_super_admin;

alter table public.profiles enable row level security;

grant usage on type public.app_role to authenticated;
grant select on public.profiles to authenticated;
grant select on public.prompts, public.prompt_images to anon, authenticated;
grant insert, update, delete on public.prompts, public.prompt_images to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  should_be_super_admin boolean := false;
begin
  if new.email_confirmed_at is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('fenjue:super_admin')
    );

    select not exists (
      select 1
      from public.profiles
      where is_super_admin
    ) into should_be_super_admin;
  end if;

  insert into public.profiles (
    id,
    display_name,
    role,
    is_super_admin
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    case
      when should_be_super_admin then 'admin'::public.app_role
      else 'user'::public.app_role
    end,
    should_be_super_admin
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public;

create or replace function public.promote_first_confirmed_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('fenjue:super_admin')
  );

  if not exists (
    select 1
    from public.profiles
    where is_super_admin
  ) then
    update public.profiles
    set
      role = 'admin',
      is_super_admin = true,
      updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (
    old.email_confirmed_at is null
    and new.email_confirmed_at is not null
  )
  execute procedure public.promote_first_confirmed_user();

revoke all on function public.promote_first_confirmed_user() from public;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can create prompts"
  on public.prompts for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update prompts"
  on public.prompts for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete prompts"
  on public.prompts for delete
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can manage prompt images"
  on public.prompt_images for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
