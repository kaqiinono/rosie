create table public.baidu_user_oauth_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id text not null check (account_id ~ '^[1-9][0-9]{0,19}$'),
  app_key text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  updated_at timestamptz not null default now()
);

alter table public.baidu_user_oauth_credentials enable row level security;
revoke all on public.baidu_user_oauth_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.baidu_user_oauth_credentials to service_role;

-- The shared credential trigger must target its singleton row under safe updates.
create or replace function private.task_planning_shared_dirty()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.task_planning_shared_epoch set revision = revision + 1 where singleton = true;
  return null;
end;
$$;
