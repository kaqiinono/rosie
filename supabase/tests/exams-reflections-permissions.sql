-- Manual-only after applying 95000. No application rows are written.
begin;
do $$
declare v_role text; v_table text; v_function text; v_privilege text;
begin
  foreach v_role in array array['anon','authenticated'] loop
    foreach v_table in array array['public.exam_question_reflections','exams_private.exam_reflection_requests'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if pg_catalog.has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'Unexpected % on % for %',v_privilege,v_table,v_role;
        end if;
      end loop;
      if pg_catalog.has_any_column_privilege(v_role,v_table,'SELECT')
        or pg_catalog.has_any_column_privilege(v_role,v_table,'UPDATE') then
        raise exception 'Unexpected reflection column access for %',v_role;
      end if;
    end loop;
    foreach v_function in array array['public.read_exam_reflections(uuid,uuid)','public.save_exam_reflection(uuid,uuid,uuid,text,uuid,text)'] loop
      if pg_catalog.has_function_privilege(v_role,v_function,'EXECUTE') then raise exception 'Unexpected reflection RPC for %',v_role; end if;
    end loop;
  end loop;
  foreach v_table in array array['public.exam_question_reflections','exams_private.exam_reflection_requests'] loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid=v_table::regclass)
      or exists (select 1 from pg_catalog.pg_policy where polrelid=v_table::regclass) then
      raise exception 'Reflection RLS boundary changed on %',v_table;
    end if;
    if not pg_catalog.has_table_privilege('service_role',v_table,'SELECT')
      or not pg_catalog.has_table_privilege('service_role',v_table,'INSERT')
      or pg_catalog.has_table_privilege('service_role',v_table,'DELETE')
      or pg_catalog.has_table_privilege('service_role',v_table,'TRUNCATE') then
      raise exception 'Incorrect service reflection grants on %',v_table;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('service_role','exams_private.exam_reflection_requests','UPDATE') then
    raise exception 'Permanent reflection receipts may be rewritten';
  end if;
  foreach v_function in array array['public.read_exam_reflections(uuid,uuid)','public.save_exam_reflection(uuid,uuid,uuid,text,uuid,text)'] loop
    if not pg_catalog.has_function_privilege('service_role',v_function,'EXECUTE')
      or (select prosecdef from pg_catalog.pg_proc where oid=v_function::regprocedure) then
      raise exception 'Incorrect reflection RPC privileges: %',v_function;
    end if;
  end loop;
end $$;
rollback;
