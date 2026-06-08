-- Reading passage narration (Supabase Storage + metadata)
-- Run in Supabase SQL Editor before using audio buttons in the app.
--
-- Storage layout:
--   reading/passages/{passage_key}/narration.mp3
--   passage_key must match reading-data.ts (e.g. u5l2, u5l3)

create table if not exists public.reading_passage_media (
  passage_key  text primary key,
  audio_path   text not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  updated_at   timestamptz not null default now()
);

create index if not exists reading_passage_media_user_id_idx
  on public.reading_passage_media (user_id);

alter table public.reading_passage_media enable row level security;

drop policy if exists "Authenticated read reading_passage_media" on public.reading_passage_media;
create policy "Authenticated read reading_passage_media"
  on public.reading_passage_media for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert reading_passage_media" on public.reading_passage_media;
create policy "Authenticated insert reading_passage_media"
  on public.reading_passage_media for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Authenticated update reading_passage_media" on public.reading_passage_media;
create policy "Authenticated update reading_passage_media"
  on public.reading_passage_media for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete reading_passage_media" on public.reading_passage_media;
create policy "Authenticated delete reading_passage_media"
  on public.reading_passage_media for delete
  to authenticated
  using (true);

-- Storage bucket (public read — same pattern as flipbook)

insert into storage.buckets (id, name, public)
values ('reading', 'reading', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read reading objects" on storage.objects;
create policy "Public read reading objects"
  on storage.objects for select
  to public
  using (bucket_id = 'reading');

drop policy if exists "Authenticated upload reading objects" on storage.objects;
create policy "Authenticated upload reading objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reading'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'passages'
  );

drop policy if exists "Authenticated update reading objects" on storage.objects;
create policy "Authenticated update reading objects"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'reading' and auth.uid() is not null)
  with check (bucket_id = 'reading' and auth.uid() is not null);

drop policy if exists "Authenticated delete reading objects" on storage.objects;
create policy "Authenticated delete reading objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'reading' and auth.uid() is not null);
