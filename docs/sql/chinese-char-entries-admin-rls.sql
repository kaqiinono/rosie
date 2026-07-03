-- Allow authenticated users to maintain Chinese curriculum content via /admin/chinese
-- Run after chinese-char-entries.sql (single-family app; all logged-in users are admins)

drop policy if exists "chinese_char_entries_mutate_auth" on public.chinese_char_entries;
create policy "chinese_char_entries_mutate_auth" on public.chinese_char_entries
  for all to authenticated using (true) with check (true);

drop policy if exists "chinese_lessons_mutate_auth" on public.chinese_lessons;
create policy "chinese_lessons_mutate_auth" on public.chinese_lessons
  for all to authenticated using (true) with check (true);

drop policy if exists "chinese_lesson_chars_mutate_auth" on public.chinese_lesson_chars;
create policy "chinese_lesson_chars_mutate_auth" on public.chinese_lesson_chars
  for all to authenticated using (true) with check (true);
