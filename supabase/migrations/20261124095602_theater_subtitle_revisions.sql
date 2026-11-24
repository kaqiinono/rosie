create table public.theater_subtitle_revision_batches (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.theater_films(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  changes jsonb not null check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) > 0),
  upload_plan jsonb check (upload_plan is null or jsonb_typeof(upload_plan) = 'object'),
  lease_until timestamptz,
  synced_at timestamptz
);

create unique index theater_subtitle_revisions_pending
  on public.theater_subtitle_revision_batches(film_id) where synced_at is null;
create index theater_subtitle_revisions_history
  on public.theater_subtitle_revision_batches(film_id, synced_at desc, id) where synced_at is not null;

alter table public.theater_subtitle_revision_batches enable row level security;
revoke all on public.theater_subtitle_revision_batches from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.theater_subtitle_revision_batches to service_role;

create function public.finish_theater_subtitle_revision_batch(
  p_film_id uuid, p_film_revision uuid, p_batch_id uuid, p_batch_version uuid,
  p_en_file_id text, p_zh_file_id text, p_fingerprints jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.theater_subtitle_revision_batches
    where id = p_batch_id and film_id = p_film_id and version = p_batch_version
      and synced_at is null and lease_until > pg_catalog.clock_timestamp()
    for update;
  if not found then return false; end if;

  update public.theater_films
    set subtitle_en_file_id = coalesce(p_en_file_id, subtitle_en_file_id),
        subtitle_zh_file_id = coalesce(p_zh_file_id, subtitle_zh_file_id),
        file_fingerprints = file_fingerprints || p_fingerprints,
        revision = pg_catalog.gen_random_uuid()
    where id = p_film_id and revision = p_film_revision and directory_id is not null;
  if not found then return false; end if;

  update public.theater_subtitle_revision_batches
    set synced_at = pg_catalog.clock_timestamp(), upload_plan = null, lease_until = null
    where id = p_batch_id;
  return true;
end;
$$;

revoke all on function public.finish_theater_subtitle_revision_batch(uuid, uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finish_theater_subtitle_revision_batch(uuid, uuid, uuid, uuid, text, text, jsonb)
  to service_role;
