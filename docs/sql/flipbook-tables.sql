-- ──────────────────────────────────────────────────────────────────────
-- Flipbook module (single public bucket + readable paths + dedupe by slug)
-- Run in Supabase SQL Editor
--
-- Storage layout:
--   flipbook/books/{slug}/pages/0001.webp  (only page images; PDF not stored)
--   flipbook/books/{slug}/narration.mp3
--   flipbook/books/{slug}/sync.json
--   flipbook/books/{slug}/pages/0001.webp
-- ──────────────────────────────────────────────────────────────────────

-- 1. flipbook_books ────────────────────────────────────────────────────

create table if not exists public.flipbook_books (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  slug            text not null unique,
  title           text not null,
  description     text,
  page_count      integer,
  pdf_path        text not null, -- legacy column name; stores pages prefix e.g. books/{slug}/pages
  audio_path      text,
  sync_manifest   jsonb,
  status          text not null default 'ready'
    check (status in ('uploading', 'processing', 'ready', 'error')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.flipbook_books add column if not exists slug text;
update public.flipbook_books
set slug = coalesce(
  nullif(
    regexp_replace(
      regexp_replace(lower(trim(title)), '\s+', '-', 'g'),
      '[^[:alnum:]_-]+',
      '',
      'g'
    ),
    ''
  ),
  'book-' || substr(id::text, 1, 8)
)
where slug is null or slug = '';
alter table public.flipbook_books alter column slug set not null;

create index if not exists flipbook_books_user_id_idx on public.flipbook_books (user_id);
create unique index if not exists flipbook_books_slug_uidx on public.flipbook_books (slug);

alter table public.flipbook_books enable row level security;

drop policy if exists "Users read own flipbook_books" on public.flipbook_books;
drop policy if exists "Users insert own flipbook_books" on public.flipbook_books;
drop policy if exists "Users update own flipbook_books" on public.flipbook_books;
drop policy if exists "Users delete own flipbook_books" on public.flipbook_books;

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

-- 2. flipbook_progress ─────────────────────────────────────────────────

create table if not exists public.flipbook_progress (
  user_id             uuid not null references auth.users(id) on delete cascade,
  book_id             uuid not null references public.flipbook_books(id) on delete cascade,
  last_page           integer not null default 1,
  audio_position_sec  numeric not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.flipbook_progress enable row level security;

drop policy if exists "Users read own flipbook_progress" on public.flipbook_progress;
create policy "Users read own flipbook_progress"
  on public.flipbook_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own flipbook_progress" on public.flipbook_progress;
create policy "Users insert own flipbook_progress"
  on public.flipbook_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own flipbook_progress" on public.flipbook_progress;
create policy "Users update own flipbook_progress"
  on public.flipbook_progress for update
  using (auth.uid() = user_id);

-- 3. Storage bucket + policies (single bucket) ──────────────────────────

insert into storage.buckets (id, name, public)
values ('flipbook', 'flipbook', true)
on conflict (id) do update set public = true;

-- Remove legacy flipbook-pdf / user-folder policies if present
drop policy if exists "Users upload own pdf" on storage.objects;
drop policy if exists "Users upload own audio" on storage.objects;
drop policy if exists "flipbook pdf insert own folder" on storage.objects;
drop policy if exists "flipbook audio insert own folder" on storage.objects;
drop policy if exists "Authenticated upload flipbook-pdf" on storage.objects;
drop policy if exists "Authenticated upload flipbook-audio" on storage.objects;

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
