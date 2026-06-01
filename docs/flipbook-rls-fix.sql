-- ──────────────────────────────────────────────────────────────────────
-- Flipbook 403 fix: "new row violates row-level security policy"
-- Run entire script in Supabase SQL Editor (logged in as project owner).
--
-- Common causes:
--   1. Bucket `flipbook` missing (code uploads there, not flipbook-pdf)
--   2. Old storage policies require path `{user_id}/...` but app uses `books/{slug}/...`
--   3. flipbook_books still has per-user-only INSERT policy
--   4. Upload without Rosie login (auth.uid() is null)
-- ──────────────────────────────────────────────────────────────────────

-- 0. Public bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('flipbook', 'flipbook', true)
on conflict (id) do update set public = true;

-- 1. flipbook_books — drop legacy per-user policies, allow any logged-in user
alter table public.flipbook_books enable row level security;

drop policy if exists "Users read own flipbook_books" on public.flipbook_books;
drop policy if exists "Users insert own flipbook_books" on public.flipbook_books;
drop policy if exists "Users update own flipbook_books" on public.flipbook_books;
drop policy if exists "Users delete own flipbook_books" on public.flipbook_books;
drop policy if exists "flipbook_books_select_own" on public.flipbook_books;
drop policy if exists "flipbook_books_insert_own" on public.flipbook_books;
drop policy if exists "flipbook_books_update_own" on public.flipbook_books;
drop policy if exists "flipbook_books_delete_own" on public.flipbook_books;

drop policy if exists "Authenticated read all flipbook_books" on public.flipbook_books;
create policy "Authenticated read all flipbook_books"
  on public.flipbook_books for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert flipbook_books" on public.flipbook_books;
create policy "Authenticated insert flipbook_books"
  on public.flipbook_books for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Authenticated update flipbook_books" on public.flipbook_books;
create policy "Authenticated update flipbook_books"
  on public.flipbook_books for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete flipbook_books" on public.flipbook_books;
create policy "Authenticated delete flipbook_books"
  on public.flipbook_books for delete
  to authenticated
  using (true);

-- 2. Storage — drop legacy flipbook-pdf / flipbook-audio / user-folder policies
drop policy if exists "Users upload own pdf" on storage.objects;
drop policy if exists "Users upload own audio" on storage.objects;
drop policy if exists "Users read own pdf" on storage.objects;
drop policy if exists "Users read own audio" on storage.objects;
drop policy if exists "Users update own pdf" on storage.objects;
drop policy if exists "Users update own audio" on storage.objects;
drop policy if exists "Users delete own pdf" on storage.objects;
drop policy if exists "Users delete own audio" on storage.objects;
drop policy if exists "flipbook pdf insert own folder" on storage.objects;
drop policy if exists "flipbook audio insert own folder" on storage.objects;
drop policy if exists "flipbook pages insert own folder" on storage.objects;
drop policy if exists "Authenticated upload flipbook-pdf" on storage.objects;
drop policy if exists "Authenticated upload flipbook-audio" on storage.objects;
drop policy if exists "Authenticated upload flipbook-pages" on storage.objects;

drop policy if exists "Public read flipbook objects" on storage.objects;
create policy "Public read flipbook objects"
  on storage.objects for select
  to public
  using (bucket_id = 'flipbook');

drop policy if exists "Authenticated upload flipbook objects" on storage.objects;
create policy "Authenticated upload flipbook objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flipbook'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'books'
  );

drop policy if exists "Authenticated update flipbook objects" on storage.objects;
create policy "Authenticated update flipbook objects"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'flipbook' and auth.uid() is not null)
  with check (bucket_id = 'flipbook' and auth.uid() is not null);

drop policy if exists "Authenticated delete flipbook objects" on storage.objects;
create policy "Authenticated delete flipbook objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'flipbook' and auth.uid() is not null);
