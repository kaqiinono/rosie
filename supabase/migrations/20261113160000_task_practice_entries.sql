-- Named owner-scoped links. Homework owns an immutable content snapshot;
-- execution cursors live in the existing atomically committed garden JSON.
create table public.task_practice_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  subject text not null check (subject in ('chinese','math','english','life')),
  path text not null check (path like '/%' and path not like '//%'),
  rows jsonb not null default '[]' check (jsonb_typeof(rows) = 'array'),
  updated_at timestamptz not null default now()
);
create index task_practice_entries_owner on public.task_practice_entries(user_id);
alter table public.task_practice_entries enable row level security;
create policy owner_entries on public.task_practice_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.task_practice_entries to authenticated;
grant all on public.task_practice_entries to service_role;
alter table public.task_homework add column practice_binding jsonb
  check (practice_binding is null or jsonb_typeof(practice_binding) = 'object');

-- A one-time initialization receipt prevents deleted presets from reappearing.
create table public.task_practice_entry_setup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initialized_at timestamptz not null default now()
);
alter table public.task_practice_entry_setup enable row level security;
create policy owner_entry_setup on public.task_practice_entry_setup for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert on public.task_practice_entry_setup to authenticated;
grant all on public.task_practice_entry_setup to service_role;
create function public.initialize_task_practice_entries(p_entries jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'login_required'; end if;
  -- The receipt and the complete set of presets commit together, including on concurrent tabs.
  insert into public.task_practice_entry_setup(user_id) values(owner_id) on conflict do nothing;
  if not found then return; end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'invalid_entries';
  end if;
  insert into public.task_practice_entries(user_id,name,subject,path,rows)
    select owner_id, entry->>'name', entry->>'subject', entry->>'path', entry->'rows'
    from jsonb_array_elements(p_entries) as item(entry);
end $$;
revoke all on function public.initialize_task_practice_entries(jsonb) from public, anon;
grant execute on function public.initialize_task_practice_entries(jsonb) to authenticated;
