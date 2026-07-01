-- English difficult-word book (难词本): persists words answered wrong in quiz/recall.
-- Run in Supabase SQL editor before using the feature.

create table if not exists public.english_wrong (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  word_key    text        not null,
  added_at    timestamptz not null default now(),
  resolved    boolean     not null default false,
  resolved_at timestamptz,
  primary key (user_id, word_key)
);

alter table public.english_wrong enable row level security;

create policy "english_wrong_select_own" on public.english_wrong
  for select using (auth.uid() = user_id);
create policy "english_wrong_insert_own" on public.english_wrong
  for insert with check (auth.uid() = user_id);
create policy "english_wrong_update_own" on public.english_wrong
  for update using (auth.uid() = user_id);
create policy "english_wrong_delete_own" on public.english_wrong
  for delete using (auth.uid() = user_id);

create index if not exists english_wrong_user_unresolved_idx
  on public.english_wrong (user_id, resolved, added_at desc);
