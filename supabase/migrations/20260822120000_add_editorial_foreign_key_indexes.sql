create index if not exists collections_created_by_idx
  on public.collections (created_by)
  where created_by is not null;

create index if not exists prompt_features_featured_by_idx
  on public.prompt_features (featured_by)
  where featured_by is not null;

create index if not exists prompt_comments_reviewed_by_idx
  on public.prompt_comments (reviewed_by)
  where reviewed_by is not null;

create index if not exists prompt_comments_tool_key_idx
  on public.prompt_comments (tool_key)
  where tool_key is not null;

comment on index public.collections_created_by_idx is
  'Covers the collection creator foreign key for profile deletion and audits';
comment on index public.prompt_features_featured_by_idx is
  'Covers the featuring administrator foreign key for profile deletion and audits';
comment on index public.prompt_comments_reviewed_by_idx is
  'Covers the reviewing administrator foreign key for profile deletion and audits';
comment on index public.prompt_comments_tool_key_idx is
  'Covers the optional AI tool foreign key and future tool filtering';
