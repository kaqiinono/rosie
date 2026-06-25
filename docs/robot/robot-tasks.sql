-- ============================================================
-- robot_tasks: 机器人任务（果果的 AI 魔法学习顾问）
--   status 不入库：由 start_time/end_time/completed_at 派生
--   （见 docs/superpowers/specs/2026-06-25-robot-task-crud-design.md §3）
--   完成（completed_at）由 sub-project D（打卡页完成）写入。
-- ============================================================
create table if not exists robot_tasks (
  id           text not null,                    -- Dify task id, e.g. task_001 (unique per user)
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  content      text not null default '',
  start_time   text not null,                    -- HH:MM
  end_time     text not null,                    -- HH:MM
  reward_coins integer not null default 10,
  quick_link   text not null default '',
  completed_at timestamptz,                       -- null = 未完成
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists robot_tasks_user_id_sort_idx on robot_tasks(user_id, sort_order);

alter table robot_tasks enable row level security;
create policy "users read own robot_tasks"
  on robot_tasks for select using (auth.uid() = user_id);
create policy "users insert own robot_tasks"
  on robot_tasks for insert with check (auth.uid() = user_id);
create policy "users update own robot_tasks"
  on robot_tasks for update using (auth.uid() = user_id);
create policy "users delete own robot_tasks"
  on robot_tasks for delete using (auth.uid() = user_id);
