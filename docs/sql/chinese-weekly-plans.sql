-- Chinese weekly study plans (一年级下册等)
-- Run in Supabase SQL editor before using the feature.

create table if not exists public.chinese_weekly_plans (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users (id) on delete cascade,
  week_start            date        not null,
  lesson_key            text        not null,
  week_start_day        integer     not null default 4,
  new_recognize_per_day integer     not null default 4,
  new_write_per_day     integer     not null default 3,
  days                  jsonb       not null default '[]'::jsonb,
  progress              jsonb       not null default '{}'::jsonb,
  updated_at            timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.chinese_weekly_plans enable row level security;

create policy "chinese_weekly_plans_select_own" on public.chinese_weekly_plans
  for select using (auth.uid() = user_id);
create policy "chinese_weekly_plans_insert_own" on public.chinese_weekly_plans
  for insert with check (auth.uid() = user_id);
create policy "chinese_weekly_plans_update_own" on public.chinese_weekly_plans
  for update using (auth.uid() = user_id);
create policy "chinese_weekly_plans_delete_own" on public.chinese_weekly_plans
  for delete using (auth.uid() = user_id);

create index if not exists chinese_weekly_plans_user_week_idx
  on public.chinese_weekly_plans (user_id, week_start desc);
