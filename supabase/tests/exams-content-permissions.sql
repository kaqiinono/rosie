-- Manual-only, after applying the foundation migration. No application data is written.
-- Run with the migration owner. These assertions cover privileges, not full API/CAS behavior.
begin;

do $$
declare
  v_role text;
  v_table text;
  v_function text;
  v_privilege text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_schema_privilege(v_role, 'exams_private', 'USAGE') then
      raise exception 'Unexpected private schema usage for %', v_role;
    end if;
    foreach v_table in array array[
      'public.exam_content_sets', 'public.exam_content_revisions', 'exams_private.exam_solutions'
    ] loop
      foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if has_table_privilege(v_role, v_table, v_privilege) then
          raise exception 'Unexpected % privilege on % for %', v_privilege, v_table, v_role;
        end if;
      end loop;
      if has_any_column_privilege(v_role, v_table, 'SELECT') then
        raise exception 'Unexpected column SELECT on % for %', v_table, v_role;
      end if;
    end loop;
    foreach v_function in array array[
      'public.save_exam_draft(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'public.read_exam_draft(text)'
    ] loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception 'Unexpected RPC execution for % on %', v_role, v_function;
      end if;
    end loop;
  end loop;

  foreach v_table in array array[
    'public.exam_content_sets', 'public.exam_content_revisions', 'exams_private.exam_solutions'
  ] loop
    if not (select relrowsecurity from pg_class where oid = v_table::regclass) then
      raise exception 'RLS disabled on %', v_table;
    end if;
    if has_table_privilege('service_role', v_table, 'TRUNCATE') then
      raise exception 'Service role may truncate immutable content: %', v_table;
    end if;
  end loop;

  foreach v_function in array array[
    'public.save_exam_draft(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'public.read_exam_draft(text)'
  ] loop
    if not has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'Service RPC execution missing on %', v_function;
    end if;
    if (select prosecdef from pg_proc where oid = v_function::regprocedure) then
      raise exception 'RPC unexpectedly uses SECURITY DEFINER: %', v_function;
    end if;
  end loop;
end $$;

rollback;
