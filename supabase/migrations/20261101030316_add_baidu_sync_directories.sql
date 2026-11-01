create table public.baidu_sync_directories (
  id uuid primary key default gen_random_uuid(),
  account_id text not null check (account_id ~ '^[1-9][0-9]{0,19}$'),
  path text not null check (left(path, 1) = '/' and octet_length(path) <= 2048),
  unique (account_id, path)
);

alter table public.baidu_sync_directories enable row level security;
revoke all on public.baidu_sync_directories from public, anon, authenticated;
grant select, insert, delete on public.baidu_sync_directories to service_role;
