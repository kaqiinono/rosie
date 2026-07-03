-- Chinese curriculum content (字表 + 课文 + 课内生字编排)
-- Run in Supabase SQL editor before docs/sql/chinese-g1b/*.sql (see README in that folder)
--
-- Runtime: app reads via useChineseCharData (authenticated SELECT).
-- Content maintenance: pnpm --filter @rosie/chinese generate-sql

-- ── 字表：一字一档，部首/笔顺必填 ─────────────────────────────────────────

create table if not exists public.chinese_char_entries (
  char_key       text        primary key,
  char           text        not null check (char ~ '^.$'),
  grade          smallint    not null,
  semester       text        not null check (semester in ('上', '下')),
  pinyin         text        not null,
  pinyin_alt     text[]      not null default '{}',
  radical        text        not null,
  radical_name   text        not null,
  structure      text        not null check (
    structure in ('上下', '左右', '独体', '半包围', '全包围', '上中下')
  ),
  stroke_count   smallint    not null check (stroke_count > 0),
  stroke_order   jsonb       not null,
  phrases        text[]      not null default '{}',
  tiers          text[]      not null default '{}' check (
    tiers <@ array['recognize', 'write']::text[]
  ),
  updated_at     timestamptz not null default now()
);

create index if not exists chinese_char_entries_grade_sem_idx
  on public.chinese_char_entries (grade, semester);

create index if not exists chinese_char_entries_char_idx
  on public.chinese_char_entries (char);

-- ── 课文元数据 + 课级词组（读一读记一记整句）──────────────────────────────

create table if not exists public.chinese_lessons (
  lesson_key     text        primary key,
  grade          smallint    not null,
  semester       text        not null check (semester in ('上', '下')),
  unit           smallint    not null,
  lesson         smallint    not null,
  lesson_title   text        not null,
  lesson_kind    text        not null default 'lesson'
    check (lesson_kind in ('lesson', 'garden', 'happy_reading')),
  unit_type      text        check (unit_type in ('literacy', 'reading')),
  sort_order     smallint    not null default 0,
  recall_phrases text[]      not null default '{}',
  updated_at     timestamptz not null default now()
);

create index if not exists chinese_lessons_grade_sem_idx
  on public.chinese_lessons (grade, semester, sort_order);

-- ── 课 ↔ 字 编排（识字表 / 写字表顺序）────────────────────────────────────

create table if not exists public.chinese_lesson_chars (
  lesson_key       text        not null references public.chinese_lessons (lesson_key) on delete cascade,
  char_key         text        not null references public.chinese_char_entries (char_key) on delete cascade,
  track            text        not null check (track in ('recognize', 'write')),
  sort_order       smallint    not null,
  pinyin_in_lesson text        not null,
  primary key (lesson_key, char_key, track)
);

create index if not exists chinese_lesson_chars_lesson_track_idx
  on public.chinese_lesson_chars (lesson_key, track, sort_order);

-- ── RLS：登录用户只读 ─────────────────────────────────────────────────────

alter table public.chinese_char_entries enable row level security;
alter table public.chinese_lessons enable row level security;
alter table public.chinese_lesson_chars enable row level security;

drop policy if exists "chinese_char_entries_select_auth" on public.chinese_char_entries;
create policy "chinese_char_entries_select_auth" on public.chinese_char_entries
  for select to authenticated using (true);

drop policy if exists "chinese_lessons_select_auth" on public.chinese_lessons;
create policy "chinese_lessons_select_auth" on public.chinese_lessons
  for select to authenticated using (true);

drop policy if exists "chinese_lesson_chars_select_auth" on public.chinese_lesson_chars;
create policy "chinese_lesson_chars_select_auth" on public.chinese_lesson_chars
  for select to authenticated using (true);
