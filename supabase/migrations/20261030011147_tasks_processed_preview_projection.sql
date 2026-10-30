-- A completed early event retains scheduled clocks but has already consumed live progress.
-- Exclude processed candidates from both preview emission and temporary advancement.
begin;

create or replace function private.task_process_due_user(p_user uuid,p_now timestamptz,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.task_courses; d date; today date:=(p_now at time zone 'Asia/Shanghai')::date; candidate record; eid uuid; used int:=0; more boolean:=false; s jsonb; projected jsonb; advancement jsonb; lead int; projected_count int;
begin
 if p_user is null or p_limit not between 1 and 1000 then raise exception 'invalid_worker_arguments'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 for c in select * from public.task_courses where user_id=p_user and archived_at is null order by coalesce(generation_date,(automation_enabled_at at time zone 'Asia/Shanghai')::date,today),id loop
 d:=coalesce(c.generation_date,(c.automation_enabled_at at time zone 'Asia/Shanghai')::date,today);
 while d<=today loop
 select * into c from public.task_courses where id=c.id;
 -- Today stays open, but previously processed/empty dates are not work-budget units.
 -- This is state based, not a timestamp equality check: adjacent client retries converge.
 if d=today and (c.generation_state<>'active' or not exists(
 select 1 from private.task_candidates(p_user,c.id,d,d) x
 left join public.task_course_events e on e.user_id=p_user and e.event_key=x.event_key
 where x.release_at<=p_now and not coalesce(e.after_processed,false)
 and coalesce(e.assignment_state,'pending')<>'cancelled'
 )) then
 update public.task_courses set generation_date=today where id=c.id;
 d:=today+1;
 exit;
 end if;
 if used>=p_limit then more:=true; exit; end if;
 used:=used+1;
 select * into c from public.task_courses where id=c.id;
 if c.generation_state='active' then
 for candidate in select * from private.task_candidates(p_user,c.id,d,d) x where x.release_at<=p_now order by x.release_at,x.event_key loop
 select * into c from public.task_courses where id=c.id;
 if c.generation_state<>'active' then exit; end if;
 eid:=private.task_materialize(p_user,c.id,to_jsonb(candidate),c.cursor);
 if c.auto_assign and not (select after_processed from public.task_course_events where id=eid) then perform private.task_emit_event(p_user,eid,'before_class',p_now); end if;
 perform private.task_finish_phase(p_user,eid,p_now);
 end loop;
 end if;
 -- Keep today's date open for later timed classes. Earlier dates never get rescanned.
 update public.task_courses set generation_date=least(d+1,today) where id=c.id;
 d:=d+1;
 end loop;
 -- A remaining old-date batch must finish before future content can be projected.
 -- Reaching the numeric limit alone is not backlog. Already caught-up courses still
 -- run their bounded preview pass, so static issues/empty today never force retry.
 if d<=today then continue; end if;
 -- Project every intervening event, even if only a far future one has a long lead.
 select * into c from public.task_courses where id=c.id;
 if c.auto_assign and c.generation_state='active' then
 select coalesce(max(t.trigger_minutes),0) into lead from public.task_course_pool_bindings b join public.task_templates t on t.user_id=b.user_id and t.id=b.pool_item_id where b.user_id=p_user and b.course_id=c.id and b.enabled and t.enabled and t.trigger='before_class';
 projected:=c.cursor; projected_count:=0;
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 for candidate in select * from private.task_candidates(p_user,c.id,today,today+(lead/1440)+1) x where x.release_at>p_now
 -- The live cursor already incorporates this event, even before its scheduled end.
 and not exists (
  select 1 from public.task_course_events processed
  where processed.user_id=p_user and processed.course_id=c.id
  and processed.event_key=x.event_key and processed.after_processed
 )
 order by x.release_at,x.event_key loop
 projected_count:=projected_count+1;
 if projected_count>256 then update public.task_courses set generation_issue='{"code":"preview_projection_limit"}' where id=c.id; exit; end if;
 if coalesce(candidate.starts_at,candidate.on_date::timestamp at time zone 'Asia/Shanghai')-make_interval(mins=>lead)<=p_now then
 eid:=private.task_materialize(p_user,c.id,to_jsonb(candidate),projected);
 perform private.task_emit_event(p_user,eid,'before_class',p_now);
 end if;
 if c.auto_advance and projected is not null then
 advancement:=private.task_advance(s,projected);
 if advancement->>'kind'<>'next' then exit; end if;
 projected:=advancement->'cursor'; end if;
 end loop;
 end if;
 end loop;
 return jsonb_build_object('processed',used,'has_more',more);
end $$;

create or replace function private.task_reconcile_previews(p_user uuid,p_course uuid,p_now timestamptz) returns void language plpgsql set search_path='' as $$
declare c public.task_courses; e public.task_course_events; candidate record; r public.task_timetable_rules; ex public.task_course_exceptions; projected jsonb; advancement jsonb; s jsonb; content jsonb; oid uuid; progression jsonb;
begin
 select * into strict c from public.task_courses where user_id=p_user and id=p_course;
 -- Carried-forward occurrences keep their original event key and source identities.
 for e in select * from public.task_course_events where user_id=p_user and course_id=c.id and release_at>p_now and not after_processed and completion_state='pending' loop
 if e.occurrence_id is not null then
 select o.rule_id,o.original_date,o.starts_at,o.ends_at,o.status into candidate from public.task_course_occurrences o where o.user_id=p_user and o.id=e.occurrence_id;
 select * into r from public.task_timetable_rules where user_id=p_user and id=candidate.rule_id;
 select * into ex from public.task_course_exceptions where user_id=p_user and rule_id=r.id and original_date=candidate.original_date;
 if r.id is not null and public.task_rule_occurs(r,candidate.original_date) and not coalesce(ex.cancelled,false) and c.archived_at is null then
 update public.task_course_events set rule_id=r.id,on_date=candidate.original_date,starts_at=coalesce(ex.starts_at,(candidate.original_date+r.start_time) at time zone 'Asia/Shanghai'),ends_at=coalesce(ex.ends_at,(candidate.original_date+r.end_time) at time zone 'Asia/Shanghai'),release_at=coalesce(ex.ends_at,(candidate.original_date+r.end_time) at time zone 'Asia/Shanghai') where id=e.id;
 continue;
 end if;
 elsif e.rule_id is null then continue;
 elsif exists(select 1 from private.task_candidates(p_user,c.id,e.on_date,e.on_date) x where x.event_key=e.event_key) then continue;
 end if;
 insert into private.task_event_revisions(user_id,event_id,revision,snapshot) values(p_user,e.id,e.revision,to_jsonb(e));
 update public.task_course_events set assignment_state='cancelled',revision=revision+1 where id=e.id;
 update public.task_instances set status='cancelled' where user_id=p_user and course_event_id=e.id and status<>'completed';
 update public.task_reminders set status='cancelled' where user_id=p_user and (occurrence_id=e.occurrence_id or task_id in(select id from public.task_instances where user_id=p_user and course_event_id=e.id)) and status in ('pending','sending','failed');
 end loop;
 projected:=c.cursor;
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 for candidate in select * from private.task_candidates(p_user,c.id,(p_now at time zone 'Asia/Shanghai')::date,coalesce((select max(on_date) from public.task_course_events where user_id=p_user and course_id=c.id and release_at>p_now),(p_now at time zone 'Asia/Shanghai')::date)) x where x.release_at>p_now
 -- The live cursor already incorporates this event, even before its scheduled end.
 and not exists (
  select 1 from public.task_course_events processed
  where processed.user_id=p_user and processed.course_id=c.id
  and processed.event_key=x.event_key and processed.after_processed
 )
 order by x.release_at,x.event_key loop
 select * into e from public.task_course_events where user_id=p_user and event_key=candidate.event_key and assignment_state<>'cancelled';
 if found and not e.after_processed and e.completion_state='pending' and e.content_origin<>'explicit' and projected is not null then
 content:=private.task_content(s,projected);
 if e.lesson_snapshot is distinct from content then perform private.task_revise_event(p_user,e.id,jsonb_build_object('cursor',projected),e.revision,p_now,false); end if;
 end if;
 if c.auto_advance and projected is not null then advancement:=private.task_advance(s,projected); if advancement->>'kind'<>'next' then exit; end if; projected:=advancement->'cursor'; end if;
 end loop;
end $$;
commit;
