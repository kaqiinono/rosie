-- A complete, administrator-triggered directory snapshot. No browser table access.
create table public.math_video_catalog (
  id text primary key check (id = 'primary'),
  file_paths text[] not null,
  keys text[] not null,
  synced_at timestamptz not null default now(),
  constraint math_video_catalog_paths_no_null check (array_position(file_paths, null) is null),
  constraint math_video_catalog_keys_no_null check (array_position(keys, null) is null)
);

alter table public.math_video_catalog enable row level security;
revoke all on table public.math_video_catalog from public, anon, authenticated;
grant select, insert, update, delete on table public.math_video_catalog to service_role;

comment on table public.math_video_catalog is
  'Last complete manual math video sync; replaced atomically only after directory enumeration succeeds.';
