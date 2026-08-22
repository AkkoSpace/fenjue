do $$
begin
  create type public.prompt_event_type as enum ('view', 'copy');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.prompt_reaction_level as enum (
    'tian',
    'di',
    'xuan',
    'huang'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.prompt_engagement_totals (
  prompt_id uuid primary key references public.prompts(id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0),
  copy_count bigint not null default 0 check (copy_count >= 0),
  like_count bigint not null default 0 check (like_count >= 0),
  reaction_tian_count bigint not null default 0
    check (reaction_tian_count >= 0),
  reaction_di_count bigint not null default 0
    check (reaction_di_count >= 0),
  reaction_xuan_count bigint not null default 0
    check (reaction_xuan_count >= 0),
  reaction_huang_count bigint not null default 0
    check (reaction_huang_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_metric_events (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  visitor_hash text not null
    check (visitor_hash ~ '^[0-9a-f]{64}$'),
  event_type public.prompt_event_type not null,
  event_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  primary key (prompt_id, visitor_hash, event_type, event_date)
);

create index if not exists prompt_metric_events_created_at_idx
  on public.prompt_metric_events (created_at);

create table if not exists public.prompt_likes (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

create index if not exists prompt_likes_user_created_at_idx
  on public.prompt_likes (user_id, created_at desc);

create table if not exists public.prompt_reactions (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level public.prompt_reaction_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

create index if not exists prompt_reactions_user_updated_at_idx
  on public.prompt_reactions (user_id, updated_at desc);

insert into public.prompt_engagement_totals (prompt_id)
select prompt.id
from public.prompts prompt
on conflict (prompt_id) do nothing;

alter table public.prompt_engagement_totals enable row level security;
alter table public.prompt_metric_events enable row level security;
alter table public.prompt_likes enable row level security;
alter table public.prompt_reactions enable row level security;

revoke all on public.prompt_engagement_totals from anon, authenticated;
revoke all on public.prompt_metric_events from anon, authenticated;
revoke all on public.prompt_likes from anon, authenticated;
revoke all on public.prompt_reactions from anon, authenticated;

grant select on public.prompt_engagement_totals to anon, authenticated;
grant usage on type public.prompt_event_type to anon, authenticated;
grant usage on type public.prompt_reaction_level to authenticated;

drop policy if exists "Published prompt engagement is anonymously readable"
  on public.prompt_engagement_totals;
drop policy if exists "Published prompt engagement is authenticated readable"
  on public.prompt_engagement_totals;

create policy "Published prompt engagement is anonymously readable"
  on public.prompt_engagement_totals for select
  to anon
  using (
    exists (
      select 1
      from public.prompts prompt
      where prompt.id = prompt_engagement_totals.prompt_id
        and prompt.published = true
        and prompt.review_status = 'approved'
    )
  );

create policy "Published prompt engagement is authenticated readable"
  on public.prompt_engagement_totals for select
  to authenticated
  using (
    exists (
      select 1
      from public.prompts prompt
      where prompt.id = prompt_engagement_totals.prompt_id
        and (
          (prompt.published = true and prompt.review_status = 'approved')
          or prompt.user_id = (select auth.uid())
          or (select public.is_admin())
        )
    )
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.apply_prompt_metric_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prompt_engagement_totals (prompt_id)
  values (new.prompt_id)
  on conflict (prompt_id) do nothing;

  update public.prompt_engagement_totals totals
  set view_count = totals.view_count
        + case when new.event_type = 'view' then 1 else 0 end,
      copy_count = totals.copy_count
        + case when new.event_type = 'copy' then 1 else 0 end,
      updated_at = now()
  where totals.prompt_id = new.prompt_id;

  return new;
end;
$$;

create or replace function private.apply_prompt_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_prompt_id uuid;
  delta integer;
begin
  if tg_op = 'INSERT' then
    target_prompt_id := new.prompt_id;
    delta := 1;
  else
    target_prompt_id := old.prompt_id;
    delta := -1;
  end if;

  insert into public.prompt_engagement_totals (prompt_id)
  values (target_prompt_id)
  on conflict (prompt_id) do nothing;

  update public.prompt_engagement_totals totals
  set like_count = greatest(0, totals.like_count + delta),
      updated_at = now()
  where totals.prompt_id = target_prompt_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.apply_prompt_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_prompt_id uuid;
  old_level public.prompt_reaction_level;
  new_level public.prompt_reaction_level;
begin
  if tg_op = 'INSERT' then
    target_prompt_id := new.prompt_id;
    new_level := new.level;
  elsif tg_op = 'UPDATE' then
    target_prompt_id := new.prompt_id;
    old_level := old.level;
    new_level := new.level;
  else
    target_prompt_id := old.prompt_id;
    old_level := old.level;
  end if;

  insert into public.prompt_engagement_totals (prompt_id)
  values (target_prompt_id)
  on conflict (prompt_id) do nothing;

  update public.prompt_engagement_totals totals
  set reaction_tian_count = greatest(
        0,
        totals.reaction_tian_count
          + case when new_level = 'tian' then 1 else 0 end
          - case when old_level = 'tian' then 1 else 0 end
      ),
      reaction_di_count = greatest(
        0,
        totals.reaction_di_count
          + case when new_level = 'di' then 1 else 0 end
          - case when old_level = 'di' then 1 else 0 end
      ),
      reaction_xuan_count = greatest(
        0,
        totals.reaction_xuan_count
          + case when new_level = 'xuan' then 1 else 0 end
          - case when old_level = 'xuan' then 1 else 0 end
      ),
      reaction_huang_count = greatest(
        0,
        totals.reaction_huang_count
          + case when new_level = 'huang' then 1 else 0 end
          - case when old_level = 'huang' then 1 else 0 end
      ),
      updated_at = now()
  where totals.prompt_id = target_prompt_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_prompt_metric_event
  on public.prompt_metric_events;
create trigger apply_prompt_metric_event
after insert on public.prompt_metric_events
for each row execute function private.apply_prompt_metric_event();

drop trigger if exists apply_prompt_like
  on public.prompt_likes;
create trigger apply_prompt_like
after insert or delete on public.prompt_likes
for each row execute function private.apply_prompt_like();

drop trigger if exists apply_prompt_reaction
  on public.prompt_reactions;
create trigger apply_prompt_reaction
after insert or update or delete on public.prompt_reactions
for each row execute function private.apply_prompt_reaction();

revoke all on function private.apply_prompt_metric_event()
  from public, anon, authenticated;
revoke all on function private.apply_prompt_like()
  from public, anon, authenticated;
revoke all on function private.apply_prompt_reaction()
  from public, anon, authenticated;

create or replace function private.prompt_engagement_payload(
  p_prompt_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'views', coalesce(totals.view_count, 0),
      'copies', coalesce(totals.copy_count, 0),
      'likes', coalesce(totals.like_count, 0),
      'reactions', jsonb_build_object(
        'tian', coalesce(totals.reaction_tian_count, 0),
        'di', coalesce(totals.reaction_di_count, 0),
        'xuan', coalesce(totals.reaction_xuan_count, 0),
        'huang', coalesce(totals.reaction_huang_count, 0)
      )
    ),
    'user', case
      when p_user_id is null then null
      else jsonb_build_object(
        'liked', exists (
          select 1
          from public.prompt_likes likes
          where likes.prompt_id = p_prompt_id
            and likes.user_id = p_user_id
        ),
        'reaction', (
          select reaction.level::text
          from public.prompt_reactions reaction
          where reaction.prompt_id = p_prompt_id
            and reaction.user_id = p_user_id
        )
      )
    end
  )
  from public.prompts prompt
  left join public.prompt_engagement_totals totals
    on totals.prompt_id = prompt.id
  where prompt.id = p_prompt_id;
$$;

revoke all on function private.prompt_engagement_payload(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.get_prompt_engagement(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_prompt_id uuid;
begin
  select prompt.id
  into target_prompt_id
  from public.prompts prompt
  where prompt.slug = p_slug
    and prompt.published = true
    and prompt.review_status = 'approved';

  if target_prompt_id is null then
    return null;
  end if;

  return private.prompt_engagement_payload(
    target_prompt_id,
    (select auth.uid())
  );
end;
$$;

create or replace function public.record_prompt_event(
  p_slug text,
  p_event_type public.prompt_event_type,
  p_visitor_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_prompt_id uuid;
begin
  if p_visitor_hash is null
    or p_visitor_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Visitor identifier is invalid';
  end if;

  select prompt.id
  into target_prompt_id
  from public.prompts prompt
  where prompt.slug = p_slug
    and prompt.published = true
    and prompt.review_status = 'approved';

  if target_prompt_id is null then
    raise exception 'Published prompt not found';
  end if;

  insert into public.prompt_metric_events (
    prompt_id,
    visitor_hash,
    event_type
  ) values (
    target_prompt_id,
    p_visitor_hash,
    p_event_type
  )
  on conflict (prompt_id, visitor_hash, event_type, event_date)
  do nothing;

  return private.prompt_engagement_payload(
    target_prompt_id,
    (select auth.uid())
  );
end;
$$;

create or replace function public.toggle_prompt_like(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_prompt_id uuid;
  target_user_id uuid := (select auth.uid());
begin
  if target_user_id is null then
    raise exception 'Authentication required';
  end if;

  select prompt.id
  into target_prompt_id
  from public.prompts prompt
  where prompt.slug = p_slug
    and prompt.published = true
    and prompt.review_status = 'approved';

  if target_prompt_id is null then
    raise exception 'Published prompt not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_user_id::text || target_prompt_id::text, 0)
  );

  if exists (
    select 1
    from public.prompt_likes likes
    where likes.prompt_id = target_prompt_id
      and likes.user_id = target_user_id
  ) then
    delete from public.prompt_likes
    where prompt_id = target_prompt_id
      and user_id = target_user_id;
  else
    insert into public.prompt_likes (prompt_id, user_id)
    values (target_prompt_id, target_user_id);
  end if;

  return private.prompt_engagement_payload(
    target_prompt_id,
    target_user_id
  );
end;
$$;

create or replace function public.toggle_prompt_reaction(
  p_slug text,
  p_reaction public.prompt_reaction_level
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reaction public.prompt_reaction_level;
  target_prompt_id uuid;
  target_user_id uuid := (select auth.uid());
begin
  if target_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_reaction is null then
    raise exception 'Reaction is required';
  end if;

  select prompt.id
  into target_prompt_id
  from public.prompts prompt
  where prompt.slug = p_slug
    and prompt.published = true
    and prompt.review_status = 'approved';

  if target_prompt_id is null then
    raise exception 'Published prompt not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_user_id::text || target_prompt_id::text, 0)
  );

  select reaction.level
  into current_reaction
  from public.prompt_reactions reaction
  where reaction.prompt_id = target_prompt_id
    and reaction.user_id = target_user_id;

  if current_reaction = p_reaction then
    delete from public.prompt_reactions
    where prompt_id = target_prompt_id
      and user_id = target_user_id;
  else
    insert into public.prompt_reactions (
      prompt_id,
      user_id,
      level
    ) values (
      target_prompt_id,
      target_user_id,
      p_reaction
    )
    on conflict (prompt_id, user_id)
    do update set
      level = excluded.level,
      updated_at = now();
  end if;

  return private.prompt_engagement_payload(
    target_prompt_id,
    target_user_id
  );
end;
$$;

create or replace function public.admin_get_engagement_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access required';
  end if;

  return (
    select jsonb_build_object(
      'views', coalesce(sum(totals.view_count), 0),
      'copies', coalesce(sum(totals.copy_count), 0),
      'likes', coalesce(sum(totals.like_count), 0),
      'reactions', coalesce(
        sum(
          totals.reaction_tian_count
          + totals.reaction_di_count
          + totals.reaction_xuan_count
          + totals.reaction_huang_count
        ),
        0
      )
    )
    from public.prompt_engagement_totals totals
  );
end;
$$;

revoke all on function public.get_prompt_engagement(text) from public;
revoke all on function public.record_prompt_event(
  text,
  public.prompt_event_type,
  text
) from public;
revoke all on function public.toggle_prompt_like(text) from public;
revoke all on function public.toggle_prompt_reaction(
  text,
  public.prompt_reaction_level
) from public;
revoke all on function public.admin_get_engagement_overview() from public;

grant execute on function public.get_prompt_engagement(text)
  to anon, authenticated;
grant execute on function public.record_prompt_event(
  text,
  public.prompt_event_type,
  text
) to anon, authenticated;
grant execute on function public.toggle_prompt_like(text)
  to authenticated;
grant execute on function public.toggle_prompt_reaction(
  text,
  public.prompt_reaction_level
) to authenticated;
grant execute on function public.admin_get_engagement_overview()
  to authenticated;

comment on table public.prompt_metric_events is
  'Daily de-duplicated anonymous view and copy events using hashed visitor IDs';
comment on table public.prompt_likes is
  'One binary like per authenticated user and prompt';
comment on table public.prompt_reactions is
  'One authenticated 天地玄黄 reaction per user and prompt';
