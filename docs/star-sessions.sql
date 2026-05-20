-- star_sessions: records stars earned from non-calc modules (english, math).
-- Global balance = sum(calc_sessions.coins_earned)
--               + sum(star_sessions.coins_earned)
--               - sum(calc_vouchers.coins_spent)
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.

create table if not exists public.star_sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  date         text        not null,
  source       text        not null check (source in ('english', 'math')),
  coins_earned integer     not null default 0 check (coins_earned >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists star_sessions_user_date_idx
  on public.star_sessions (user_id, date);

alter table public.star_sessions enable row level security;

drop policy if exists "star_sessions_own" on public.star_sessions;
create policy "star_sessions_own" on public.star_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
