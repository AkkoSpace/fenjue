alter table public.prompts
  add column if not exists content_relation text not null default 'repost';

alter table public.prompts
  drop constraint if exists prompts_content_relation_check;

alter table public.prompts
  add constraint prompts_content_relation_check
  check (content_relation in ('original', 'repost', 'adapted'));

comment on column public.prompts.content_relation is
  'Relationship between the credited author and the published content';

create or replace function public.create_prompt_with_images(
  p_slug text,
  p_title text,
  p_prompt text,
  p_author_name text,
  p_author_url text,
  p_source_url text,
  p_images jsonb,
  p_is_nsfw boolean,
  p_content_relation text
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

  if p_content_relation is null
    or p_content_relation not in ('original', 'repost', 'adapted') then
    raise exception 'Invalid content relation';
  end if;

  insert into public.prompts (
    user_id,
    slug,
    title,
    prompt,
    author_name,
    author_url,
    source_url,
    is_nsfw,
    content_relation,
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
    coalesce(p_is_nsfw, false),
    p_content_relation,
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
  jsonb,
  boolean,
  text
) from public;

grant execute on function public.create_prompt_with_images(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  text
) to authenticated;
