-- Chinese wrong book (生字/词语/日积月累错题)
-- Run in Supabase SQL editor before using /chinese/wrong

create table if not exists public.chinese_wrong_items (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  item_key    text        not null,
  item_type   text        not null check (item_type in ('char', 'phrase', 'accumulation', 'poem')),
  wrong_kind  text        not null check (wrong_kind in ('pinyin', 'stroke', 'phrase', 'recite', 'accumulation')),
  added_at    timestamptz not null default now(),
  resolved    boolean     not null default false,
  resolved_at timestamptz,
  primary key (user_id, item_key, wrong_kind)
);

alter table public.chinese_wrong_items enable row level security;

create policy "chinese_wrong_select_own" on public.chinese_wrong_items
  for select using (auth.uid() = user_id);
create policy "chinese_wrong_insert_own" on public.chinese_wrong_items
  for insert with check (auth.uid() = user_id);
create policy "chinese_wrong_update_own" on public.chinese_wrong_items
  for update using (auth.uid() = user_id);
create policy "chinese_wrong_delete_own" on public.chinese_wrong_items
  for delete using (auth.uid() = user_id);

create index if not exists chinese_wrong_user_unresolved_idx
  on public.chinese_wrong_items (user_id, resolved, added_at desc);
