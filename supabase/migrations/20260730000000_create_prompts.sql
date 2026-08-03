create extension if not exists "pgcrypto";

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  prompt text not null,
  author_name text not null,
  author_url text not null,
  source_url text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_images (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  position smallint not null check (position > 0),
  object_key text not null,
  alt text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  unique (prompt_id, position)
);

create index if not exists prompts_published_at_idx
  on public.prompts (published, published_at desc);

alter table public.prompts enable row level security;
alter table public.prompt_images enable row level security;

create policy "Published prompts are publicly readable"
  on public.prompts for select
  using (published = true);

create policy "Images for published prompts are publicly readable"
  on public.prompt_images for select
  using (
    exists (
      select 1 from public.prompts
      where public.prompts.id = prompt_images.prompt_id
        and public.prompts.published = true
    )
  );
