alter table public.ai_tools
  add column if not exists description text not null default '',
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ai_tools
  drop constraint if exists ai_tools_sort_order_key;

alter table public.ai_tools
  drop constraint if exists ai_tools_key_format_check,
  drop constraint if exists ai_tools_name_length_check,
  drop constraint if exists ai_tools_description_length_check,
  drop constraint if exists ai_tools_logo_url_check,
  drop constraint if exists ai_tools_website_url_check,
  drop constraint if exists ai_tools_sort_order_check;

alter table public.ai_tools
  add constraint ai_tools_key_format_check
    check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint ai_tools_name_length_check
    check (char_length(trim(name)) between 1 and 48),
  add constraint ai_tools_description_length_check
    check (char_length(description) <= 160),
  add constraint ai_tools_logo_url_check
    check (
      logo_url is null
      or (logo_url ~ '^https://' and char_length(logo_url) <= 2048)
    ),
  add constraint ai_tools_website_url_check
    check (
      website_url is null
      or (website_url ~ '^https://' and char_length(website_url) <= 2048)
    ),
  add constraint ai_tools_sort_order_check
    check (sort_order between 1 and 32767);

create index if not exists ai_tools_sort_order_key_idx
  on public.ai_tools (sort_order, key);

create index if not exists prompt_comments_tool_key_idx
  on public.prompt_comments (tool_key)
  where tool_key is not null;

create or replace function private.touch_ai_tools_updated_at()
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

revoke all on function private.touch_ai_tools_updated_at()
  from public, anon, authenticated;

drop trigger if exists touch_ai_tools_updated_at on public.ai_tools;
create trigger touch_ai_tools_updated_at
before update on public.ai_tools
for each row execute function private.touch_ai_tools_updated_at();

drop policy if exists "Active AI tools are publicly readable"
  on public.ai_tools;
drop policy if exists "AI tools are publicly readable"
  on public.ai_tools;
create policy "AI tools are publicly readable"
  on public.ai_tools for select
  using (true);

grant insert, update, delete on public.ai_tools to authenticated;

drop policy if exists "Admins can create AI tools" on public.ai_tools;
create policy "Admins can create AI tools"
  on public.ai_tools for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update AI tools" on public.ai_tools;
create policy "Admins can update AI tools"
  on public.ai_tools for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete AI tools" on public.ai_tools;
create policy "Admins can delete AI tools"
  on public.ai_tools for delete
  to authenticated
  using ((select public.is_admin()));

create or replace function public.admin_get_ai_tools()
returns table (
  key text,
  name text,
  description text,
  logo_url text,
  website_url text,
  active boolean,
  sort_order smallint,
  created_at timestamptz,
  updated_at timestamptz,
  prompt_usage_count bigint,
  comment_usage_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tool.key,
    tool.name,
    tool.description,
    tool.logo_url,
    tool.website_url,
    tool.active,
    tool.sort_order,
    tool.created_at,
    tool.updated_at,
    (
      select count(*)
      from public.prompt_ai_tools prompt_tool
      where prompt_tool.tool_key = tool.key
    ) as prompt_usage_count,
    (
      select count(*)
      from public.prompt_comments comment
      where comment.tool_key = tool.key
    ) as comment_usage_count
  from public.ai_tools tool
  where (select public.is_admin())
  order by tool.sort_order, tool.name, tool.key;
$$;

revoke all on function public.admin_get_ai_tools() from public;
grant execute on function public.admin_get_ai_tools() to authenticated;

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
  active_tool_keys text[];
  current_published boolean;
  inactive_tool_keys text[];
  removed_object_keys text[];
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

  if coalesce(cardinality(p_tool_keys), 0) > 4
    or array_position(p_tool_keys, null) is not null
    or (
      select count(*) <> count(distinct selected.tool_key)
      from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key)
    ) then
    raise exception 'Invalid verified tools';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key)
    left join public.ai_tools tool on tool.key = selected.tool_key
    where tool.key is null
      or (
        not tool.active
        and not exists (
          select 1
          from public.prompt_ai_tools existing
          where existing.prompt_id = p_id
            and existing.tool_key = selected.tool_key
        )
      )
  ) then
    raise exception 'Unknown or unavailable verified tool';
  end if;

  select
    coalesce(array_agg(tool.key order by tool.sort_order) filter (where tool.active), array[]::text[]),
    coalesce(array_agg(tool.key order by tool.sort_order) filter (where not tool.active), array[]::text[])
  into active_tool_keys, inactive_tool_keys
  from unnest(coalesce(p_tool_keys, array[]::text[])) as selected(tool_key)
  join public.ai_tools tool on tool.key = selected.tool_key;

  removed_object_keys := private.admin_update_prompt(
    p_id,
    p_title,
    p_prompt,
    p_author_name,
    p_author_url,
    p_source_url,
    p_images,
    p_is_nsfw,
    p_content_relation,
    active_tool_keys,
    p_category_key,
    p_tag_keys,
    current_published
  );

  insert into public.prompt_ai_tools (prompt_id, tool_key)
  select p_id, selected.tool_key
  from unnest(inactive_tool_keys) as selected(tool_key)
  on conflict (prompt_id, tool_key) do nothing;

  return removed_object_keys;
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
