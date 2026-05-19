-- ──────────────────────────────────────────────────────────────────────
-- 口算 mastery system migration — run in Supabase SQL Editor
-- Idempotent: safe to re-run.
--
-- Prerequisite: existing tables `calc_settings`, `calc_mistakes`,
-- `calc_sessions`, `calc_vouchers` already created.
--
-- Sections:
--   1. Difficulty range upgrade (12 → 18 levels)
--   2. calc_settings additions (session_counter, time_limit_overrides)
--   3. calc_problem_state — per-problem proficiency / status / timing
--   4. calc_level_state   — per-level state machine
--   5. calc_event_log     — audit trail for upgrades / downgrades / forced
--   6. Drop level_cap (replaced by hard-coded MAX_NUMERIC_LEVEL = 18)
-- ──────────────────────────────────────────────────────────────────────

-- 1. Difficulty range upgrade ─────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'calc_settings_level_cap_check') then
    alter table public.calc_settings drop constraint calc_settings_level_cap_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'calc_settings_current_level_check') then
    alter table public.calc_settings drop constraint calc_settings_current_level_check;
  end if;
end $$;

alter table public.calc_settings
  add constraint calc_settings_current_level_check
  check (current_level between 1 and 18);

-- 2. calc_settings additions ──────────────────────────────────────────
alter table public.calc_settings
  add column if not exists session_counter integer not null default 0,
  add column if not exists time_limit_overrides jsonb not null default '{}'::jsonb;

-- 3. calc_problem_state ──────────────────────────────────────────────
create table if not exists public.calc_problem_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  level smallint not null,
  proficiency smallint not null default 0 check (proficiency between 0 and 5),
  attempt_count integer not null default 0,
  appearance_count integer not null default 0,
  recent_results jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','review','mastered','forced')),
  short_mastered_at date,
  review_r1_due date,
  review_r2_due date,
  review_r3_due date,
  long_mastered boolean not null default false,
  last_seen_session integer,
  times_seen_this_round integer not null default 0,
  consecutive_wrong integer not null default 0,
  forced_next boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, signature)
);

create index if not exists calc_problem_state_user_level_idx
  on public.calc_problem_state (user_id, level);
create index if not exists calc_problem_state_user_status_idx
  on public.calc_problem_state (user_id, status);

alter table public.calc_problem_state enable row level security;
drop policy if exists "calc_problem_state_select_own" on public.calc_problem_state;
create policy "calc_problem_state_select_own" on public.calc_problem_state
  for select using (auth.uid() = user_id);
drop policy if exists "calc_problem_state_modify_own" on public.calc_problem_state;
create policy "calc_problem_state_modify_own" on public.calc_problem_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. calc_level_state ────────────────────────────────────────────────
create table if not exists public.calc_level_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  level smallint not null,
  status text not null default 'practicing' check (status in
    ('practicing','abc_passed','review_r1','review_r2','review_r3','mastered')),
  abc_passed_date date,
  review_r1_date date,
  review_r2_date date,
  review_r3_date date,
  session_count_in_level integer not null default 0,
  warmup_complete boolean not null default false,
  warmup_answered integer not null default 0,
  last_session_accuracy real,
  consecutive_poor_sessions integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, level)
);

alter table public.calc_level_state enable row level security;
drop policy if exists "calc_level_state_select_own" on public.calc_level_state;
create policy "calc_level_state_select_own" on public.calc_level_state
  for select using (auth.uid() = user_id);
drop policy if exists "calc_level_state_modify_own" on public.calc_level_state;
create policy "calc_level_state_modify_own" on public.calc_level_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. calc_event_log ──────────────────────────────────────────────────
create table if not exists public.calc_event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in
    ('level_up','level_down','review_pass','review_fail','assault_mode_on','forced_problem')),
  level smallint,
  signature text,
  detail jsonb
);

create index if not exists calc_event_log_user_time_idx
  on public.calc_event_log (user_id, occurred_at desc);

alter table public.calc_event_log enable row level security;
drop policy if exists "calc_event_log_select_own" on public.calc_event_log;
create policy "calc_event_log_select_own" on public.calc_event_log
  for select using (auth.uid() = user_id);
drop policy if exists "calc_event_log_modify_own" on public.calc_event_log;
create policy "calc_event_log_modify_own" on public.calc_event_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Drop level_cap ───────────────────────────────────────────────────
-- The per-user upper-limit was redundant: it only bounded the adaptive
-- auto-advance, which is already controlled by the `adaptive` toggle.
-- The app now hard-codes the ceiling at MAX_NUMERIC_LEVEL (Lv.18).
alter table public.calc_settings
  drop column if exists level_cap;

-- 7. Free-practice mode ───────────────────────────────────────────────
-- `free_mode` toggles a user-driven custom session: when true, sessions
-- mix questions only from the levels listed in `free_mode_levels`
-- (a JSON array of CalcLevel values — numbers 1..18 and/or the string 'C'
-- for the challenge level). Mastery state machine + adaptive level-up
-- are skipped in this mode; per-problem proficiency is still recorded.
alter table public.calc_settings
  add column if not exists free_mode boolean not null default false,
  add column if not exists free_mode_levels jsonb not null default '[]'::jsonb;
