-- Homework definitions under 课程安排 (/tasks/homework). Additive only: one new owner-scoped table.
-- Safe to run more than once (SQL Editor or CLI): nothing existing is dropped or truncated.
create table if not exists public.task_homework (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 120),
 subject text not null check(subject in ('chinese','math','english','life')),
 cycle text not null check(cycle in ('daily','weekly','custom')),
 -- Required for weekly/custom, null for daily. Default 1.
 times_per_week int check(times_per_week between 1 and 7),
 -- weekly: start/end weekday (0=Sunday..6=Saturday). custom: start/end date. daily: all null.
 start_weekday smallint check(start_weekday between 0 and 6),
 end_weekday smallint check(end_weekday between 0 and 6),
 start_date date,
 end_date date,
 estimated_minutes int not null check(estimated_minutes between 1 and 120),
 notes text not null default '' check(length(notes)<=2000),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(
  (cycle='daily' and times_per_week is null and start_weekday is null and end_weekday is null and start_date is null and end_date is null)
  or (cycle='weekly' and times_per_week is not null and start_weekday is not null and end_weekday is not null and start_date is null and end_date is null
      and times_per_week<=((end_weekday-start_weekday+7)%7)+1)
  or (cycle='custom' and times_per_week is not null and start_weekday is null and end_weekday is null and start_date is not null and end_date is not null and end_date>=start_date)
 )
);

create or replace function public.task_homework_touch() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
drop trigger if exists task_homework_touch on public.task_homework;
create trigger task_homework_touch before update on public.task_homework
 for each row execute function public.task_homework_touch();

alter table public.task_homework enable row level security;
revoke all on public.task_homework from anon;
grant select,insert,update,delete on public.task_homework to authenticated;
grant all on public.task_homework to service_role;
drop policy if exists own_rows on public.task_homework;
create policy own_rows on public.task_homework for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index if not exists task_homework_user_id_idx on public.task_homework(user_id);
