-- Manual-only after applying the attempt migration; run as the migration owner.
-- No application rows are created. These assertions cover privileges and immutable
-- storage boundaries; transition/CAS/clock behavior belongs to API integration tests.
begin;

do $$
declare
  v_role text; v_table text; v_function text; v_privilege text;
  v_tables text[] := array['public.exam_attempts','public.exam_material_exposures','exams_private.exam_attempt_requests'];
  v_functions text[] := array[
    'public.create_exam_attempt(uuid,uuid,text,jsonb,text)',
    'public.read_exam_attempt(uuid,uuid)',
    'public.find_exam_attempt_request(uuid,uuid,text)',
    'public.commit_exam_attempt(uuid,uuid,uuid,uuid,text,jsonb,text[],text,uuid)',
    'public.authorize_exam_media(uuid,uuid,text,text,text)',
    'exams_private.exam_attempt_state_valid(jsonb,jsonb)',
    'exams_private.guard_exam_attempt()',
    'exams_private.record_exam_exposure(uuid,uuid,jsonb,text[])',
    'exams_private.exam_media_slot_in_scope(jsonb,jsonb,jsonb,jsonb,text,timestamptz)'
  ];
begin
  foreach v_role in array array['anon','authenticated'] loop
    if pg_catalog.has_schema_privilege(v_role,'exams_private','USAGE') then
      raise exception 'Unexpected private schema usage for %',v_role;
    end if;
    foreach v_table in array v_tables loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if pg_catalog.has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'Unexpected % privilege on % for %',v_privilege,v_table,v_role;
        end if;
      end loop;
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
        if pg_catalog.has_any_column_privilege(v_role,v_table,v_privilege) then
          raise exception 'Unexpected column % on % for %',v_privilege,v_table,v_role;
        end if;
      end loop;
    end loop;
    foreach v_function in array v_functions loop
      if pg_catalog.has_function_privilege(v_role,v_function,'EXECUTE') then
        raise exception 'Unexpected attempt/helper execution for % on %',v_role,v_function;
      end if;
    end loop;
    if pg_catalog.has_table_privilege(v_role,'exams_private.exam_solutions','SELECT') then
      raise exception 'Attempt support accidentally exposed private solutions to %',v_role;
    end if;
  end loop;

  foreach v_table in array v_tables loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid = v_table::regclass) then
      raise exception 'RLS disabled on %',v_table;
    end if;
    if exists (select 1 from pg_catalog.pg_policy where polrelid = v_table::regclass) then
      raise exception 'Service-only table unexpectedly has a browser RLS policy: %',v_table;
    end if;
    foreach v_privilege in array array['SELECT','INSERT'] loop
      if not pg_catalog.has_table_privilege('service_role',v_table,v_privilege) then
        raise exception 'Missing service % privilege on %',v_privilege,v_table;
      end if;
    end loop;
    foreach v_privilege in array array['DELETE','TRUNCATE','TRIGGER'] loop
      if pg_catalog.has_table_privilege('service_role',v_table,v_privilege) then
        raise exception 'Service may destroy immutable history via % on %',v_privilege,v_table;
      end if;
    end loop;
  end loop;
  if not pg_catalog.has_table_privilege('service_role','public.exam_attempts','UPDATE') then
    raise exception 'Missing service attempt UPDATE';
  end if;
  foreach v_table in array array['public.exam_material_exposures','exams_private.exam_attempt_requests'] loop
    if pg_catalog.has_table_privilege('service_role',v_table,'UPDATE')
      or pg_catalog.has_any_column_privilege('service_role',v_table,'UPDATE') then
      raise exception 'Service may rewrite permanent exposure/receipt history: %',v_table;
    end if;
  end loop;
  foreach v_function in array v_functions loop
    if not pg_catalog.has_function_privilege('service_role',v_function,'EXECUTE') then
      raise exception 'Missing service execution on %',v_function;
    end if;
    if (select prosecdef from pg_catalog.pg_proc where oid = v_function::regprocedure) then
      raise exception 'Attempt function unexpectedly uses SECURITY DEFINER: %',v_function;
    end if;
    if not exists (select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.unnest(p.proconfig) c(setting)
      where p.oid = v_function::regprocedure and c.setting in ('search_path=""','search_path=')) then
      raise exception 'Attempt function lacks an empty search_path: %',v_function;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.exam_attempts'::regclass and tgname = 'exam_attempt_guard'
      and not tgisinternal and tgenabled <> 'D') then
    raise exception 'Attempt content/owner immutability guard is absent';
  end if;
end $$;

rollback;
