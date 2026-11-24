create table public.theater_subtitle_jobs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^[a-f0-9]{64}$'),
  account_id text not null,
  account_generation uuid not null,
  directory_id uuid references public.baidu_sync_directories(id) on delete set null,
  directory_path text not null,
  video_id text not null check (video_id ~ '^[1-9][0-9]{0,19}$'),
  video_path text not null,
  video_size bigint not null check (video_size > 0),
  video_md5 text,
  video_modified_at bigint,
  requested_by uuid references auth.users(id) on delete set null,
  state text not null default 'queued' check (state in (
    'queued', 'submitting', 'transcribing', 'writing', 'ready', 'failed', 'submission_unknown'
  )),
  provider_task_id text,
  source_expires_at bigint,
  attempts integer not null default 0 check (attempts >= 0),
  lease_id uuid,
  lease_until timestamptz,
  next_run_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error_code text,
  subtitle jsonb
);
alter table public.theater_subtitle_jobs enable row level security;
revoke all on public.theater_subtitle_jobs from public, anon, authenticated, service_role;
grant select, insert, update on public.theater_subtitle_jobs to service_role;
create index theater_subtitle_job_due on public.theater_subtitle_jobs(next_run_at, id)
  where state in ('queued', 'submitting', 'transcribing', 'writing');
create index theater_subtitle_job_directory on public.theater_subtitle_jobs(directory_id);
create index theater_subtitle_job_actor on public.theater_subtitle_jobs(requested_by);

create function public.claim_theater_subtitle_job()
returns setof public.theater_subtitle_jobs language sql security invoker set search_path = '' as $$
  with due as (
    select id from public.theater_subtitle_jobs
    where state in ('queued', 'submitting', 'transcribing', 'writing')
      and next_run_at <= now()
      and (lease_until is null or lease_until <= now())
    order by next_run_at, id
    limit 1 for update skip locked
  )
  update public.theater_subtitle_jobs job
    set lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes', updated_at = now()
    from due where job.id = due.id
    returning job.*;
$$;
revoke all on function public.claim_theater_subtitle_job() from public, anon, authenticated, service_role;
grant execute on function public.claim_theater_subtitle_job() to service_role;

create function public.configure_theater_subtitle_worker(p_origin text, p_signing_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_id uuid;
  current_config jsonb;
  wanted jsonb;
begin
  if p_origin is null or p_origin !~ '^https://[a-z0-9.-]+$'
    or p_signing_key is null or p_signing_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_theater_worker_config';
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is null
    or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'theater_worker_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtext('rosie-theater-subtitle-worker'));
  wanted := jsonb_build_object('origin', p_origin, 'key', p_signing_key);
  select id, decrypted_secret::jsonb into current_id, current_config
    from vault.decrypted_secrets where name = 'rosie_theater_subtitle_worker';
  if current_id is null then
    perform vault.create_secret(wanted::text, 'rosie_theater_subtitle_worker', 'Rosie subtitle cron configuration');
  elsif current_config->>'origin' is distinct from p_origin then
    raise exception 'theater_worker_origin_conflict';
  elsif current_config is distinct from wanted then
    perform vault.update_secret(current_id, wanted::text);
  end if;
end;
$$;
revoke all on function public.configure_theater_subtitle_worker(text, text) from public, anon, authenticated, service_role;
grant execute on function public.configure_theater_subtitle_worker(text, text) to service_role;

create function private.dispatch_theater_subtitle_worker()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  config jsonb;
  issued_at text;
  origin text;
  signature text;
begin
  if not exists (
    select 1 from public.theater_subtitle_jobs
    where state in ('queued', 'submitting', 'transcribing', 'writing')
      and next_run_at <= now() and (lease_until is null or lease_until <= now())
  ) then return; end if;

  select decrypted_secret::jsonb into config
  from vault.decrypted_secrets where name = 'rosie_theater_subtitle_worker';
  origin := config->>'origin';
  if origin is null or origin !~ '^https://[a-z0-9.-]+$'
      or coalesce(config->>'key', '') !~ '^[a-f0-9]{64}$' then return; end if;

  issued_at := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature := encode(extensions.hmac(
    convert_to('theater-worker:' || issued_at || ':' || origin, 'UTF8'),
    convert_to(config->>'key', 'UTF8'), 'sha256'
  ), 'hex');
  perform net.http_post(
    url := origin || '/api/internal/theater-subtitles',
    body := jsonb_build_object('origin', origin),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || issued_at || '.' || signature),
    timeout_milliseconds := 110000
  );
end;
$$;
revoke all on function private.dispatch_theater_subtitle_worker() from public, anon, authenticated, service_role;

do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null
      and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    perform cron.schedule('rosie-theater-subtitle-worker', '* * * * *', 'select private.dispatch_theater_subtitle_worker()');
  end if;
end $$;

notify pgrst, 'reload schema';
