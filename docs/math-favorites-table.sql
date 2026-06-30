-- docs/math-favorites-table.sql
-- 数学题目收藏：每行 = 用户收藏了某道题。键对齐 math_solved.problem_id / Problem.id。
create table if not exists public.math_favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  problem_id text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

alter table public.math_favorites enable row level security;

create policy "math_favorites_select_own" on public.math_favorites
  for select using (auth.uid() = user_id);
create policy "math_favorites_insert_own" on public.math_favorites
  for insert with check (auth.uid() = user_id);
create policy "math_favorites_delete_own" on public.math_favorites
  for delete using (auth.uid() = user_id);