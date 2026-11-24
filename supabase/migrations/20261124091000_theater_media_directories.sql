create table public.theater_media_directories (
  account_id text primary key check (account_id ~ '^[1-9][0-9]{0,19}$'),
  directory_id uuid not null references public.baidu_sync_directories(id) on delete cascade,
  revision uuid not null default gen_random_uuid()
);

create index theater_media_directories_directory_id on public.theater_media_directories(directory_id);

alter table public.theater_media_directories enable row level security;
revoke all on public.theater_media_directories from public, anon, authenticated, service_role;
grant select, insert, update on public.theater_media_directories to service_role;

notify pgrst, 'reload schema';
