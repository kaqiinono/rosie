-- Click-time preset apply. The setup receipt means this owner already has presets.
-- The first call inserts the supplied set. Later calls refresh same-subject,
-- same-name rows when the path or list changed, and insert presets that are absent.
-- Opening entry management does not call this function.
create function public.apply_task_practice_presets(p_entries jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  entry_name text;
  entry_subject text;
  entry_path text;
  entry_rows jsonb;
  changed bigint;
  updated_count bigint := 0;
  inserted_count bigint := 0;
begin
  if owner_id is null then
    raise exception 'login_required';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'invalid_entries';
  end if;

  for item in select preset.value from jsonb_array_elements(p_entries) as preset(value)
  loop
    entry_name := btrim(item->>'name');
    entry_subject := item->>'subject';
    entry_path := item->>'path';
    entry_rows := item->'rows';
    if entry_name is null
      or char_length(entry_name) < 1
      or char_length(entry_name) > 120
      or entry_subject is null
      or entry_subject not in ('chinese', 'math', 'english', 'life')
      or entry_path is null
      or entry_path not like '/%'
      or entry_path like '//%'
      or entry_rows is null
      or jsonb_typeof(entry_rows) <> 'array' then
      raise exception 'invalid_entries';
    end if;
  end loop;

  if (
    select count(*)
    from (
      select distinct btrim(preset.entry->>'name'), preset.entry->>'subject'
      from jsonb_array_elements(p_entries) as preset(entry)
    ) as distinct_entries
  ) <> jsonb_array_length(p_entries) then
    raise exception 'invalid_entries';
  end if;

  insert into public.task_practice_entry_setup(user_id)
  values (owner_id)
  on conflict do nothing;

  if found then
    insert into public.task_practice_entries(user_id, name, subject, path, rows)
    select owner_id,
           btrim(preset.entry->>'name'),
           preset.entry->>'subject',
           preset.entry->>'path',
           preset.entry->'rows'
    from jsonb_array_elements(p_entries) as preset(entry);
    return jsonb_build_object(
      'mode', 'created',
      'updated', 0,
      'inserted', jsonb_array_length(p_entries)
    );
  end if;

  for item in select preset.value from jsonb_array_elements(p_entries) as preset(value)
  loop
    entry_name := btrim(item->>'name');
    entry_subject := item->>'subject';
    entry_path := item->>'path';
    entry_rows := item->'rows';

    update public.task_practice_entries
    set path = entry_path,
        rows = entry_rows,
        updated_at = now()
    where user_id = owner_id
      and subject = entry_subject
      and name = entry_name
      and (path is distinct from entry_path or rows is distinct from entry_rows);
    get diagnostics changed = row_count;
    updated_count := updated_count + changed;

    if not exists (
      select 1
      from public.task_practice_entries
      where user_id = owner_id
        and subject = entry_subject
        and name = entry_name
    ) then
      insert into public.task_practice_entries(user_id, name, subject, path, rows)
      values (owner_id, entry_name, entry_subject, entry_path, entry_rows);
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'mode', case when updated_count > 0 or inserted_count > 0 then 'updated' else 'current' end,
    'updated', updated_count,
    'inserted', inserted_count
  );
end;
$$;

revoke all on function public.apply_task_practice_presets(jsonb) from public, anon;
grant execute on function public.apply_task_practice_presets(jsonb) to authenticated;

comment on function public.apply_task_practice_presets(jsonb) is
  'Creates practice presets on the first call and refreshes same-subject, same-name presets on later calls.';
comment on table public.task_practice_entry_setup is
  'Records that the owner has received practice presets. Later preset clicks update matching rows instead of inserting another full set.';

NOTIFY pgrst, 'reload schema';
