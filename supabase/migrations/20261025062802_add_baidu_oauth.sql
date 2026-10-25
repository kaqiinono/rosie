-- A single administrator-authorized Netdisk account, reserved for future audio access.
begin;

create table public.baidu_oauth_credentials (
  id text primary key default 'primary' check (id = 'primary'),
  app_key text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  authorized_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.baidu_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  initiated_by uuid not null references auth.users(id) on delete cascade,
  app_key text not null,
  redirect_uri text not null,
  expires_at timestamptz not null
);
create index baidu_oauth_states_expires_at_idx on public.baidu_oauth_states (expires_at);

alter table public.baidu_oauth_credentials enable row level security;
alter table public.baidu_oauth_states enable row level security;
revoke all on table public.baidu_oauth_credentials from public, anon, authenticated;
revoke all on table public.baidu_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on table public.baidu_oauth_credentials to service_role;
grant select, insert, update, delete on table public.baidu_oauth_states to service_role;

comment on table public.baidu_oauth_credentials is
  'Server-only Baidu OAuth secrets. No client policies or token-returning API endpoints.';
comment on table public.baidu_oauth_states is
  'Ten-minute, hashed, single-use authorization attempts, consumed with DELETE RETURNING.';

commit;
