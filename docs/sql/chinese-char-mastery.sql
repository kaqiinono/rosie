-- Chinese character mastery (认读 / 会写 分轨)
-- Run in Supabase SQL editor before using the feature.

create table if not exists public.chinese_char_mastery (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  char_key         text        not null,
  track            text        not null check (track in ('recognize', 'write')),
  correct          integer     not null default 0,
  incorrect        integer     not null default 0,
  last_seen        date,
  stage            integer,
  next_review_date date,
  is_hard          boolean     not null default false,
  review_history   jsonb       not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  primary key (user_id, char_key, track)
);

alter table public.chinese_char_mastery enable row level security;

create policy "chinese_char_mastery_select_own" on public.chinese_char_mastery
  for select using (auth.uid() = user_id);
create policy "chinese_char_mastery_insert_own" on public.chinese_char_mastery
  for insert with check (auth.uid() = user_id);
create policy "chinese_char_mastery_update_own" on public.chinese_char_mastery
  for update using (auth.uid() = user_id);
create policy "chinese_char_mastery_delete_own" on public.chinese_char_mastery
  for delete using (auth.uid() = user_id);

create index if not exists chinese_char_mastery_user_review_idx
  on public.chinese_char_mastery (user_id, track, next_review_date);
