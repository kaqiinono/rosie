create table public.tomato_timer_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object')
);

alter table public.tomato_timer_sessions enable row level security;
revoke all on public.tomato_timer_sessions from anon, authenticated;
grant select, insert, update on public.tomato_timer_sessions to authenticated;

create policy own_timer on public.tomato_timer_sessions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
