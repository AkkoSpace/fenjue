-- 平台与模型图标目录：来源平台与生成工具分开维护，Logo 最终由后台配置的地址提供。

alter table public.ai_tools
  add column if not exists brand_color text;

alter table public.ai_tools
  drop constraint if exists ai_tools_brand_color_check;

alter table public.ai_tools
  add constraint ai_tools_brand_color_check
    check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$');

update public.ai_tools
set brand_color = case key
  when 'nano-banana' then '#4285F4'
  when 'doubao' then '#4D53E8'
  when 'grok' then '#000000'
  when 'chatgpt' then '#10A37F'
  else brand_color
end
where brand_color is null;

drop function if exists public.admin_get_ai_tools();
create function public.admin_get_ai_tools()
returns table (
  key text,
  name text,
  description text,
  logo_url text,
  brand_color text,
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
    tool.brand_color,
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

create table if not exists public.source_platforms (
  key text primary key,
  name text not null,
  logo_url text,
  brand_color text,
  website_url text,
  active boolean not null default true,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_platforms_name_unique unique (name),
  constraint source_platforms_key_format_check
    check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint source_platforms_name_length_check
    check (char_length(trim(name)) between 1 and 48),
  constraint source_platforms_logo_url_check
    check (
      logo_url is null
      or (logo_url ~ '^https://' and char_length(logo_url) <= 2048)
    ),
  constraint source_platforms_brand_color_check
    check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint source_platforms_website_url_check
    check (
      website_url is null
      or (website_url ~ '^https://' and char_length(website_url) <= 2048)
    ),
  constraint source_platforms_sort_order_check
    check (sort_order between 1 and 32767)
);

insert into public.source_platforms (key, name, brand_color, sort_order)
values
  ('bilibili', '哔哩哔哩', '#FB7299', 1),
  ('xiaoheihe', '小黑盒', '#1F2937', 2),
  ('xiaohongshu', '小红书', '#FF2442', 3),
  ('github', 'GitHub', '#181717', 4),
  ('youtube', 'YouTube', '#FF0000', 5),
  ('douyin', '抖音', '#111111', 6)
on conflict (key) do nothing;

update public.source_platforms
set logo_url = 'https://fenjue-images.akko.space/catalog/icons/platforms/xiaoheihe.ico'
where key = 'xiaoheihe'
  and logo_url is null;

alter table public.prompts
  add column if not exists source_platform_key text
    references public.source_platforms(key) on delete set null;

create index if not exists prompts_source_platform_key_idx
  on public.prompts (source_platform_key)
  where source_platform_key is not null;

create index if not exists source_platforms_sort_order_key_idx
  on public.source_platforms (sort_order, key);

create or replace function private.touch_source_platforms_updated_at()
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

revoke all on function private.touch_source_platforms_updated_at()
  from public, anon, authenticated;

drop trigger if exists touch_source_platforms_updated_at on public.source_platforms;
create trigger touch_source_platforms_updated_at
before update on public.source_platforms
for each row execute function private.touch_source_platforms_updated_at();

alter table public.source_platforms enable row level security;
revoke all on public.source_platforms from anon, authenticated;
grant select on public.source_platforms to anon, authenticated;
grant insert, update, delete on public.source_platforms to authenticated;

drop policy if exists "Active source platforms are publicly readable"
  on public.source_platforms;
create policy "Active source platforms are publicly readable"
  on public.source_platforms for select
  to anon
  using (active);

drop policy if exists "Users can read active source platforms"
  on public.source_platforms;
create policy "Users can read active source platforms"
  on public.source_platforms for select
  to authenticated
  using (active or (select public.is_admin()));

drop policy if exists "Admins can create source platforms"
  on public.source_platforms;
create policy "Admins can create source platforms"
  on public.source_platforms for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update source platforms"
  on public.source_platforms;
create policy "Admins can update source platforms"
  on public.source_platforms for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete source platforms"
  on public.source_platforms;
create policy "Admins can delete source platforms"
  on public.source_platforms for delete
  to authenticated
  using ((select public.is_admin()));

drop function if exists public.admin_get_source_platforms();
create function public.admin_get_source_platforms()
returns table (
  key text,
  name text,
  logo_url text,
  brand_color text,
  website_url text,
  active boolean,
  sort_order smallint,
  created_at timestamptz,
  updated_at timestamptz,
  prompt_usage_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    platform.key,
    platform.name,
    platform.logo_url,
    platform.brand_color,
    platform.website_url,
    platform.active,
    platform.sort_order,
    platform.created_at,
    platform.updated_at,
    (
      select count(*)
      from public.prompts prompt
      where prompt.source_platform_key = platform.key
    ) as prompt_usage_count
  from public.source_platforms platform
  where (select public.is_admin())
  order by platform.sort_order, platform.name, platform.key;
$$;

revoke all on function public.admin_get_source_platforms() from public;
grant execute on function public.admin_get_source_platforms() to authenticated;

-- 为调用方增加来源平台参数；旧事务保留为带 legacy 后缀的兼容入口，实际业务逻辑继续复用已审计实现。
do $$
begin
  if to_regprocedure('public.create_prompt_with_images(text,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is not null
    and to_regprocedure('public.create_prompt_with_images_legacy(text,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is null then
    execute 'alter function public.create_prompt_with_images(text,text,text,text,text,text,jsonb,boolean,text,text[],text,text[]) rename to create_prompt_with_images_legacy';
  end if;
end;
$$;

create or replace function public.create_prompt_with_images(
  p_slug text,
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
  p_tag_keys text[],
  p_source_platform_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_prompt_id uuid;
begin
  if p_source_platform_key is not null and not exists (
    select 1
    from public.source_platforms platform
    where platform.key = p_source_platform_key
      and platform.active
  ) then
    raise exception 'Unknown or inactive source platform';
  end if;

  new_prompt_id := public.create_prompt_with_images_legacy(
    p_slug,
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
    p_tag_keys
  );

  update public.prompts
  set source_platform_key = p_source_platform_key
  where id = new_prompt_id;

  return new_prompt_id;
end;
$$;

revoke all on function public.create_prompt_with_images(
  text, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) from public;
grant execute on function public.create_prompt_with_images(
  text, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) to authenticated;

revoke all on function public.create_prompt_with_images_legacy(
  text, text, text, text, text, text, jsonb, boolean, text, text[], text, text[]
) from public;

do $$
begin
  if to_regprocedure('public.update_own_prompt_content(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is not null
    and to_regprocedure('public.update_own_prompt_content_legacy(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is null then
    execute 'alter function public.update_own_prompt_content(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[]) rename to update_own_prompt_content_legacy';
  end if;
end;
$$;

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
  p_tag_keys text[],
  p_source_platform_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_source_platform_key is not null and not exists (
    select 1
    from public.source_platforms platform
    where platform.key = p_source_platform_key
      and platform.active
  ) then
    raise exception 'Unknown or inactive source platform';
  end if;

  result := public.update_own_prompt_content_legacy(
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
    p_tag_keys
  );

  update public.prompts
  set source_platform_key = p_source_platform_key
  where id = p_id and user_id = (select auth.uid());

  return result;
end;
$$;

revoke all on function public.update_own_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) from public;
grant execute on function public.update_own_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) to authenticated;

revoke all on function public.update_own_prompt_content_legacy(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[]
) from public;

do $$
begin
  if to_regprocedure('public.admin_update_prompt_content(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is not null
    and to_regprocedure('public.admin_update_prompt_content_legacy(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[])') is null then
    execute 'alter function public.admin_update_prompt_content(uuid,text,text,text,text,text,jsonb,boolean,text,text[],text,text[]) rename to admin_update_prompt_content_legacy';
  end if;
end;
$$;

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
  p_tag_keys text[],
  p_source_platform_key text
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_object_keys text[];
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  if p_source_platform_key is not null and not exists (
    select 1
    from public.source_platforms platform
    where platform.key = p_source_platform_key
  ) then
    raise exception 'Unknown source platform';
  end if;

  removed_object_keys := public.admin_update_prompt_content_legacy(
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
    p_tag_keys
  );

  update public.prompts
  set source_platform_key = p_source_platform_key
  where id = p_id;

  return removed_object_keys;
end;
$$;

revoke all on function public.admin_update_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) from public;
grant execute on function public.admin_update_prompt_content(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[], text
) to authenticated;

revoke all on function public.admin_update_prompt_content_legacy(
  uuid, text, text, text, text, text, jsonb, boolean, text, text[], text, text[]
) from public;
