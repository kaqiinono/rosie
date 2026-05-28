-- ──────────────────────────────────────────────────────────────────────
-- 计算模块 v2 migration — run in Supabase SQL Editor
-- Idempotent: safe to re-run (all policies use DROP + CREATE).
--
-- Tables:
--   1. calculate_settings      — 用户全局设置
--   2. calculate_topic_state   — 知识点掌握状态
--   3. calculate_level_state   — 关卡三档状态
--   4. calculate_sessions      — Session 记录
--   5. calculate_mistakes      — 错题记录
--   6. calculate_event_log     — 事件日志
-- ──────────────────────────────────────────────────────────────────────

-- 0. Drop old misspelled tables (caculate_*) ─────────────────────────

drop table if exists public.caculate_event_log cascade;
drop table if exists public.caculate_mistakes cascade;
drop table if exists public.caculate_sessions cascade;
drop table if exists public.caculate_level_state cascade;
drop table if exists public.caculate_topic_state cascade;
drop table if exists public.caculate_settings cascade;

-- 1. calculate_settings ────────────────────────────────────────────────

create table if not exists public.calculate_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  unlocked_levels    text[] not null default '{NS-1,NS-2,NS-3,NS-4}',
  theta_per_tree     jsonb not null default '{}'::jsonb,
  sound_enabled      boolean not null default true,
  focus_mode         boolean not null default false,
  daily_target       integer not null default 20,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.calculate_settings enable row level security;

drop policy if exists "Users read own calculate_settings" on public.calculate_settings;
create policy "Users read own calculate_settings"
  on public.calculate_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_settings" on public.calculate_settings;
create policy "Users insert own calculate_settings"
  on public.calculate_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own calculate_settings" on public.calculate_settings;
create policy "Users update own calculate_settings"
  on public.calculate_settings for update
  using (auth.uid() = user_id);

-- 2. calculate_topic_state ─────────────────────────────────────────────

create table if not exists public.calculate_topic_state (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  topic_id           text not null,
  mastery_rate       real not null default 0 check (mastery_rate between 0 and 1),
  review_interval    integer not null default 1,
  next_review_date   date,
  error_tags         text[] not null default '{}',
  attempt_count      integer not null default 0,
  correct_count      integer not null default 0,
  recent_results     jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  unique (user_id, topic_id)
);

alter table public.calculate_topic_state enable row level security;

drop policy if exists "Users read own calculate_topic_state" on public.calculate_topic_state;
create policy "Users read own calculate_topic_state"
  on public.calculate_topic_state for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_topic_state" on public.calculate_topic_state;
create policy "Users insert own calculate_topic_state"
  on public.calculate_topic_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own calculate_topic_state" on public.calculate_topic_state;
create policy "Users update own calculate_topic_state"
  on public.calculate_topic_state for update
  using (auth.uid() = user_id);

-- 3. calculate_level_state ─────────────────────────────────────────────

create table if not exists public.calculate_level_state (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  level_id                 text not null,
  tier_beginner            text not null default 'locked'
    check (tier_beginner in ('locked','practicing','passed')),
  tier_advanced            text not null default 'locked'
    check (tier_advanced in ('locked','practicing','passed')),
  tier_challenge           text not null default 'locked'
    check (tier_challenge in ('locked','practicing','passed')),
  best_accuracy_beginner   real,
  best_accuracy_advanced   real,
  best_accuracy_challenge  real,
  session_count            integer not null default 0,
  updated_at               timestamptz not null default now(),
  unique (user_id, level_id)
);

alter table public.calculate_level_state enable row level security;

drop policy if exists "Users read own calculate_level_state" on public.calculate_level_state;
create policy "Users read own calculate_level_state"
  on public.calculate_level_state for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_level_state" on public.calculate_level_state;
create policy "Users insert own calculate_level_state"
  on public.calculate_level_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own calculate_level_state" on public.calculate_level_state;
create policy "Users update own calculate_level_state"
  on public.calculate_level_state for update
  using (auth.uid() = user_id);

-- 4. calculate_sessions ────────────────────────────────────────────────

create table if not exists public.calculate_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null default current_date,
  mode               text not null check (mode in ('daily','level','mistakes')),
  level_id           text,
  tier               text check (tier is null or tier in ('beginner','advanced','challenge')),
  count              integer not null,
  correct_count      integer not null,
  wrong_count        integer not null,
  time_spent_sec     integer not null,
  stars_earned       integer not null default 0,
  max_streak         integer not null default 0,
  error_summary      jsonb not null default '{}'::jsonb,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz not null default now()
);

alter table public.calculate_sessions enable row level security;

drop policy if exists "Users read own calculate_sessions" on public.calculate_sessions;
create policy "Users read own calculate_sessions"
  on public.calculate_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_sessions" on public.calculate_sessions;
create policy "Users insert own calculate_sessions"
  on public.calculate_sessions for insert
  with check (auth.uid() = user_id);

-- 5. calculate_mistakes ────────────────────────────────────────────────

create table if not exists public.calculate_mistakes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  question_signature    text not null,
  level_id              text not null,
  user_answer           text not null,
  correct_answer        text not null,
  error_tag             text,
  distractor_type       text,
  consecutive_correct   integer not null default 0,
  resolved              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.calculate_mistakes enable row level security;

drop policy if exists "Users read own calculate_mistakes" on public.calculate_mistakes;
create policy "Users read own calculate_mistakes"
  on public.calculate_mistakes for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_mistakes" on public.calculate_mistakes;
create policy "Users insert own calculate_mistakes"
  on public.calculate_mistakes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own calculate_mistakes" on public.calculate_mistakes;
create policy "Users update own calculate_mistakes"
  on public.calculate_mistakes for update
  using (auth.uid() = user_id);

-- 6. calculate_event_log ───────────────────────────────────────────────

create table if not exists public.calculate_event_log (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  event_type         text not null,
  level_id           text,
  detail             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

alter table public.calculate_event_log enable row level security;

drop policy if exists "Users read own calculate_event_log" on public.calculate_event_log;
create policy "Users read own calculate_event_log"
  on public.calculate_event_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own calculate_event_log" on public.calculate_event_log;
create policy "Users insert own calculate_event_log"
  on public.calculate_event_log for insert
  with check (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────

create index if not exists idx_calculate_topic_state_user
  on public.calculate_topic_state(user_id);

create index if not exists idx_calculate_level_state_user
  on public.calculate_level_state(user_id);

create index if not exists idx_calculate_sessions_user_date
  on public.calculate_sessions(user_id, date);

create index if not exists idx_calculate_mistakes_user_resolved
  on public.calculate_mistakes(user_id, resolved);

create index if not exists idx_calculate_event_log_user
  on public.calculate_event_log(user_id, created_at desc);
