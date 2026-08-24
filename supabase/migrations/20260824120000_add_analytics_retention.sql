create table if not exists public.prompt_metric_daily_totals (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  metric_date date not null,
  view_count bigint not null default 0 check (view_count >= 0),
  copy_count bigint not null default 0 check (copy_count >= 0),
  first_event_at timestamptz not null,
  last_event_at timestamptz not null,
  primary key (prompt_id, metric_date)
);

create index if not exists prompt_metric_daily_totals_date_idx
  on public.prompt_metric_daily_totals (metric_date desc, prompt_id);

insert into public.prompt_metric_daily_totals (
  prompt_id,
  metric_date,
  view_count,
  copy_count,
  first_event_at,
  last_event_at
)
select
  event.prompt_id,
  event.event_date,
  count(*) filter (where event.event_type = 'view'),
  count(*) filter (where event.event_type = 'copy'),
  min(event.created_at),
  max(event.created_at)
from public.prompt_metric_events event
group by event.prompt_id, event.event_date
on conflict (prompt_id, metric_date)
do update set
  view_count = excluded.view_count,
  copy_count = excluded.copy_count,
  first_event_at = excluded.first_event_at,
  last_event_at = excluded.last_event_at;

create table if not exists public.prompt_metric_archive_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'processing'
    check (status in ('processing', 'failed', 'completed')),
  event_count integer not null default 0 check (event_count >= 0),
  min_event_date date,
  max_event_date date,
  object_key text,
  content_sha256 text
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  compressed_bytes bigint
    check (compressed_bytes is null or compressed_bytes >= 0),
  format_version smallint not null default 1 check (format_version = 1),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (event_count = 0 and min_event_date is null and max_event_date is null)
    or
    (event_count > 0 and min_event_date is not null and max_event_date is not null)
  ),
  check (min_event_date is null or max_event_date >= min_event_date),
  check (
    status <> 'completed'
    or (
      object_key is not null
      and content_sha256 is not null
      and compressed_bytes is not null
      and completed_at is not null
    )
  )
);

create index if not exists prompt_metric_archive_batches_status_idx
  on public.prompt_metric_archive_batches (
    status,
    lease_expires_at,
    created_at
  );

alter table public.prompt_metric_events
  add column if not exists archive_batch_id uuid
  references public.prompt_metric_archive_batches(id) on delete set null;

create index if not exists prompt_metric_events_archive_batch_idx
  on public.prompt_metric_events (archive_batch_id)
  where archive_batch_id is not null;

create index if not exists prompt_metric_events_unarchived_date_idx
  on public.prompt_metric_events (event_date, created_at)
  where archive_batch_id is null;

create table if not exists public.prompt_metric_storage_counters (
  singleton boolean primary key default true check (singleton),
  hot_event_count bigint not null default 0 check (hot_event_count >= 0),
  archived_event_count bigint not null default 0
    check (archived_event_count >= 0),
  archived_file_count bigint not null default 0
    check (archived_file_count >= 0),
  archived_compressed_bytes bigint not null default 0
    check (archived_compressed_bytes >= 0),
  updated_at timestamptz not null default now()
);

insert into public.prompt_metric_storage_counters (
  singleton,
  hot_event_count
)
select true, count(*)
from public.prompt_metric_events
on conflict (singleton)
do update set
  hot_event_count = excluded.hot_event_count,
  updated_at = now();

alter table public.prompt_metric_daily_totals enable row level security;
alter table public.prompt_metric_archive_batches enable row level security;
alter table public.prompt_metric_storage_counters enable row level security;

revoke all on public.prompt_metric_daily_totals
  from public, anon, authenticated;
revoke all on public.prompt_metric_archive_batches
  from public, anon, authenticated;
revoke all on public.prompt_metric_storage_counters
  from public, anon, authenticated;

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

  insert into public.prompt_metric_daily_totals (
    prompt_id,
    metric_date,
    view_count,
    copy_count,
    first_event_at,
    last_event_at
  ) values (
    new.prompt_id,
    new.event_date,
    case when new.event_type = 'view' then 1 else 0 end,
    case when new.event_type = 'copy' then 1 else 0 end,
    new.created_at,
    new.created_at
  )
  on conflict (prompt_id, metric_date)
  do update set
    view_count = public.prompt_metric_daily_totals.view_count
      + excluded.view_count,
    copy_count = public.prompt_metric_daily_totals.copy_count
      + excluded.copy_count,
    first_event_at = least(
      public.prompt_metric_daily_totals.first_event_at,
      excluded.first_event_at
    ),
    last_event_at = greatest(
      public.prompt_metric_daily_totals.last_event_at,
      excluded.last_event_at
    );

  insert into public.prompt_metric_storage_counters (
    singleton,
    hot_event_count
  ) values (true, 1)
  on conflict (singleton)
  do update set
    hot_event_count = public.prompt_metric_storage_counters.hot_event_count + 1,
    updated_at = now();

  return new;
end;
$$;

create or replace function private.apply_prompt_metric_event_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count bigint;
begin
  select count(*) into removed_count from deleted_events;

  if removed_count > 0 then
    update public.prompt_metric_storage_counters counters
    set hot_event_count = greatest(0, counters.hot_event_count - removed_count),
        updated_at = now()
    where counters.singleton = true;
  end if;

  return null;
end;
$$;

drop trigger if exists apply_prompt_metric_event_delete
  on public.prompt_metric_events;
create trigger apply_prompt_metric_event_delete
after delete on public.prompt_metric_events
referencing old table as deleted_events
for each statement execute function private.apply_prompt_metric_event_delete();

revoke all on function private.apply_prompt_metric_event_delete()
  from public, anon, authenticated;

create or replace function public.claim_prompt_metric_archive(
  p_cutoff date,
  p_limit integer default 10000,
  p_lease_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.prompt_metric_archive_batches%rowtype;
  target_batch_id uuid;
  target_event_count integer;
  target_max_date date;
  target_min_date date;
  target_month_start date;
  target_oldest_date date;
begin
  if p_cutoff is null or p_cutoff >= (timezone('utc', now()))::date then
    raise exception 'Archive cutoff must be before today';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 25000 then
    raise exception 'Archive batch size must be between 1 and 25000';
  end if;

  if p_lease_seconds is null
    or p_lease_seconds < 60
    or p_lease_seconds > 3600
  then
    raise exception 'Archive lease must be between 60 and 3600 seconds';
  end if;

  select batch.*
  into target_batch
  from public.prompt_metric_archive_batches batch
  where batch.status in ('processing', 'failed')
    and batch.completed_at is null
    and (
      batch.status = 'failed'
      or batch.lease_expires_at is null
      or batch.lease_expires_at <= now()
    )
    and exists (
      select 1
      from public.prompt_metric_events event
      where event.archive_batch_id = batch.id
    )
  order by batch.created_at, batch.id
  for update skip locked
  limit 1;

  if target_batch.id is not null then
    update public.prompt_metric_archive_batches
    set status = 'processing',
        attempt_count = attempt_count + 1,
        lease_expires_at = now()
          + make_interval(secs => p_lease_seconds),
        last_error = null,
        started_at = now(),
        updated_at = now()
    where id = target_batch.id
    returning * into target_batch;

    return jsonb_build_object(
      'id', target_batch.id,
      'event_count', target_batch.event_count,
      'min_event_date', target_batch.min_event_date,
      'max_event_date', target_batch.max_event_date,
      'attempt_count', target_batch.attempt_count
    );
  end if;

  select event.event_date
  into target_oldest_date
  from public.prompt_metric_events event
  where event.archive_batch_id is null
    and event.event_date < p_cutoff
  order by event.event_date, event.created_at
  limit 1;

  if target_oldest_date is null then
    return null;
  end if;

  target_month_start := date_trunc('month', target_oldest_date)::date;
  target_batch_id := gen_random_uuid();

  insert into public.prompt_metric_archive_batches (
    id,
    status,
    event_count,
    attempt_count,
    lease_expires_at
  ) values (
    target_batch_id,
    'processing',
    0,
    1,
    now() + make_interval(secs => p_lease_seconds)
  );

  with candidates as (
    select
      event.prompt_id,
      event.visitor_hash,
      event.event_type,
      event.event_date
    from public.prompt_metric_events event
    where event.archive_batch_id is null
      and event.event_date >= target_month_start
      and event.event_date < target_month_start + interval '1 month'
      and event.event_date < p_cutoff
    order by
      event.event_date,
      event.created_at,
      event.prompt_id,
      event.event_type,
      event.visitor_hash
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.prompt_metric_events event
    set archive_batch_id = target_batch_id
    from candidates candidate
    where event.prompt_id = candidate.prompt_id
      and event.visitor_hash = candidate.visitor_hash
      and event.event_type = candidate.event_type
      and event.event_date = candidate.event_date
    returning event.event_date
  )
  select count(*), min(event_date), max(event_date)
  into target_event_count, target_min_date, target_max_date
  from claimed;

  if target_event_count = 0 then
    delete from public.prompt_metric_archive_batches
    where id = target_batch_id;
    return null;
  end if;

  update public.prompt_metric_archive_batches
  set event_count = target_event_count,
      min_event_date = target_min_date,
      max_event_date = target_max_date,
      updated_at = now()
  where id = target_batch_id
  returning * into target_batch;

  return jsonb_build_object(
    'id', target_batch.id,
    'event_count', target_batch.event_count,
    'min_event_date', target_batch.min_event_date,
    'max_event_date', target_batch.max_event_date,
    'attempt_count', target_batch.attempt_count
  );
end;
$$;

create or replace function public.complete_prompt_metric_archive(
  p_batch_id uuid,
  p_object_key text,
  p_content_sha256 text,
  p_compressed_bytes bigint,
  p_event_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_event_count integer;
  target_batch public.prompt_metric_archive_batches%rowtype;
begin
  if p_object_key is null
    or p_object_key !~ '^analytics/prompt-metrics/v1/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.ndjson\.gz$'
  then
    raise exception 'Archive object key is invalid';
  end if;

  if p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Archive digest is invalid';
  end if;

  if p_compressed_bytes is null or p_compressed_bytes < 1 then
    raise exception 'Archive size is invalid';
  end if;

  select batch.*
  into target_batch
  from public.prompt_metric_archive_batches batch
  where batch.id = p_batch_id
  for update;

  if target_batch.id is null or target_batch.status <> 'processing' then
    raise exception 'Archive batch is not processing';
  end if;

  select count(*)
  into actual_event_count
  from public.prompt_metric_events event
  where event.archive_batch_id = p_batch_id;

  if p_event_count is null
    or p_event_count <> target_batch.event_count
    or actual_event_count <> target_batch.event_count
  then
    raise exception 'Archive event count does not match claimed rows';
  end if;

  delete from public.prompt_metric_events
  where archive_batch_id = p_batch_id;

  update public.prompt_metric_archive_batches
  set status = 'completed',
      object_key = p_object_key,
      content_sha256 = p_content_sha256,
      compressed_bytes = p_compressed_bytes,
      lease_expires_at = null,
      last_error = null,
      completed_at = now(),
      updated_at = now()
  where id = p_batch_id
  returning * into target_batch;

  update public.prompt_metric_storage_counters counters
  set archived_event_count = counters.archived_event_count + p_event_count,
      archived_file_count = counters.archived_file_count + 1,
      archived_compressed_bytes = counters.archived_compressed_bytes
        + p_compressed_bytes,
      updated_at = now()
  where counters.singleton = true;

  return jsonb_build_object(
    'id', target_batch.id,
    'event_count', target_batch.event_count,
    'object_key', target_batch.object_key,
    'compressed_bytes', target_batch.compressed_bytes,
    'completed_at', target_batch.completed_at
  );
end;
$$;

create or replace function public.fail_prompt_metric_archive(
  p_batch_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.prompt_metric_archive_batches
  set status = 'failed',
      lease_expires_at = null,
      last_error = left(coalesce(nullif(trim(p_error), ''), 'Unknown error'), 500),
      updated_at = now()
  where id = p_batch_id
    and status <> 'completed';
end;
$$;

create or replace function public.admin_get_analytics_storage_overview()
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
      'hot_events', counters.hot_event_count,
      'archived_events', counters.archived_event_count,
      'archived_files', counters.archived_file_count,
      'archived_compressed_bytes', counters.archived_compressed_bytes,
      'oldest_hot_event_date', (
        select min(event.event_date)
        from public.prompt_metric_events event
      ),
      'pending_batches', (
        select count(*)
        from public.prompt_metric_archive_batches batch
        where batch.status <> 'completed'
      ),
      'last_archived_at', (
        select max(batch.completed_at)
        from public.prompt_metric_archive_batches batch
        where batch.status = 'completed'
      )
    )
    from public.prompt_metric_storage_counters counters
    where counters.singleton = true
  );
end;
$$;

revoke all on function public.claim_prompt_metric_archive(date, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_prompt_metric_archive(
  uuid,
  text,
  text,
  bigint,
  integer
) from public, anon, authenticated;
revoke all on function public.fail_prompt_metric_archive(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_get_analytics_storage_overview()
  from public;

grant execute on function public.claim_prompt_metric_archive(
  date,
  integer,
  integer
) to service_role;
grant execute on function public.complete_prompt_metric_archive(
  uuid,
  text,
  text,
  bigint,
  integer
) to service_role;
grant execute on function public.fail_prompt_metric_archive(uuid, text)
  to service_role;
grant execute on function public.admin_get_analytics_storage_overview()
  to authenticated;

comment on table public.prompt_metric_daily_totals is
  'Permanent daily view and copy aggregates retained after raw event archival';
comment on table public.prompt_metric_archive_batches is
  'Retryable manifest for private R2 archives of anonymous metric events';
comment on table public.prompt_metric_storage_counters is
  'Constant-time counters for hot and archived prompt metric storage';
