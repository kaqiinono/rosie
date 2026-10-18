-- Turn the legacy one-row-per-user calc settings table into named strategies.
-- Existing rows remain the active strategy for their owner.

alter table public.calc_settings
  add column id uuid default gen_random_uuid(),
  add column name text not null default '默认策略',
  add column is_active boolean not null default true,
  add column created_at timestamptz not null default now();

update public.calc_settings
set id = gen_random_uuid()
where id is null;

alter table public.calc_settings
  alter column id set not null,
  drop constraint calc_settings_pkey,
  add constraint calc_settings_pkey primary key (id),
  add constraint calc_settings_name_not_blank check (length(btrim(name)) between 1 and 40);

create index calc_settings_user_updated_idx
  on public.calc_settings (user_id, updated_at desc);

create unique index calc_settings_one_active_per_user_idx
  on public.calc_settings (user_id)
  where is_active;

drop policy if exists calc_settings_modify_own on public.calc_settings;
drop policy if exists calc_settings_select_own on public.calc_settings;

create policy calc_settings_select_own
  on public.calc_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy calc_settings_insert_own
  on public.calc_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy calc_settings_update_own
  on public.calc_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy calc_settings_delete_own
  on public.calc_settings for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.calc_settings from anon;
grant select, insert, update, delete on table public.calc_settings to authenticated;

create or replace function public.set_calc_strategy_enabled(strategy_id uuid, enabled boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not exists (
    select 1
    from public.calc_settings
    where id = strategy_id and user_id = caller_id
  ) then
    raise exception 'calc strategy not found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  if enabled then
    update public.calc_settings
    set is_active = false, updated_at = now()
    where user_id = caller_id and is_active;
  end if;

  update public.calc_settings
  set is_active = enabled, updated_at = now()
  where id = strategy_id and user_id = caller_id;
end;
$$;

create or replace function public.delete_calc_strategy(strategy_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  deleted_was_active boolean;
  replacement_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  select is_active into deleted_was_active
  from public.calc_settings
  where id = strategy_id and user_id = caller_id
  for update;

  if not found then
    raise exception 'calc strategy not found' using errcode = '42501';
  end if;

  delete from public.calc_settings
  where id = strategy_id and user_id = caller_id;

  if deleted_was_active then
    select id into replacement_id
    from public.calc_settings
    where user_id = caller_id
    order by updated_at desc, created_at desc
    limit 1
    for update;

    if replacement_id is not null then
      update public.calc_settings
      set is_active = true, updated_at = now()
      where id = replacement_id;
    end if;
  end if;
end;
$$;

revoke all on function public.set_calc_strategy_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_calc_strategy_enabled(uuid, boolean) to authenticated;
revoke all on function public.delete_calc_strategy(uuid) from public, anon;
grant execute on function public.delete_calc_strategy(uuid) to authenticated;
