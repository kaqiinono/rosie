-- Forward-only Task4 report corrections: ordering, bounded convergence, overdue history.
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
 for candidate in select * from private.task_candidates(p_user,c.id,today,today+(lead/1440)+1) x where x.release_at>p_now order by x.release_at,x.event_key loop
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

create or replace function public.task_confirm_course(p_occurrence uuid,p_confirmation jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.task_course_events; o public.task_course_occurrences; eid uuid;
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into strict o from public.task_course_occurrences where user_id=u and id=p_occurrence;
 -- Legacy void clients cannot consume a typed retry. Like the archive compatibility
 -- wrapper, require a separate same-engine tick if bounded compensation is incomplete.
 if (private.task_process_due_user(u,now(),100)->>'has_more')::boolean then raise exception 'catch_up_required'; end if;
 select * into e from public.task_course_events where user_id=u and occurrence_id=o.id;
 if not found then
 eid:=private.task_materialize(u,o.course_id,jsonb_build_object('event_key','timetabled:'||o.rule_id||':'||o.original_date,'rule_id',o.rule_id,'on_date',o.original_date,'starts_at',o.starts_at,'ends_at',o.ends_at,'release_at',o.ends_at,'occurrence_id',o.id),(select cursor from public.task_courses where user_id=u and id=o.course_id));
 select * into e from public.task_course_events where id=eid;
 end if;
 if e.lesson_snapshot is null and p_confirmation->'lesson' is not null then
 perform private.task_revise_event(u,e.id,jsonb_build_object('lesson',p_confirmation->'lesson'),e.revision,now());
 select * into e from public.task_course_events where id=e.id;
 end if;
 perform private.task_complete_event(u,e.id,e.revision,now());
end $$;

create or replace function private.task_emit_event(p_user uuid,p_event uuid,p_phase text,p_now timestamptz,p_revise boolean default false) returns void language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; matches jsonb; m jsonb; t jsonb; target jsonb; material jsonb; deadline jsonb; next_event jsonb; completed_unit jsonb; item public.task_instances; new_items jsonb; changed boolean; keys text[]:='{}'; key text; label text; taskid uuid; selection text; old_item jsonb; phase_release timestamptz; raw_release timestamptz; window_issue jsonb;
begin
 select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
 select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
 if e.assignment_state='cancelled' or c.archived_at is not null then return; end if;
 if e.lesson_snapshot->'lesson'->>'key' is not null and (e.progression_result->>'kind'='finished' or (e.next_snapshot->'lesson'->>'key' is not null and (e.next_snapshot->'lesson'->>'book' is distinct from e.lesson_snapshot->'lesson'->>'book' or e.next_snapshot->'lesson'->>'unit' is distinct from e.lesson_snapshot->'lesson'->>'unit'))) then completed_unit:=jsonb_build_object('book',e.lesson_snapshot->'lesson'->>'book','unit',e.lesson_snapshot->'lesson'->>'unit'); end if;
 matches:=private.task_matches(to_jsonb(e),(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.task_course_pool_bindings b where b.user_id=p_user and b.course_id=c.id),(select coalesce(jsonb_agg(to_jsonb(tx)),'[]') from public.task_templates tx where tx.user_id=p_user),e.next_snapshot,completed_unit);
 next_event:=private.task_next_candidate(p_user,c.id,to_jsonb(e));
 for m in select v from jsonb_array_elements(matches) v loop
 t:=m->'template';
 if (p_phase='before_class') is distinct from (t->>'trigger'='before_class') then continue; end if;
 raw_release:=case when p_phase='before_class' then coalesce(e.starts_at,e.on_date::timestamp at time zone 'Asia/Shanghai')-make_interval(mins=>(t->>'trigger_minutes')::int) else e.release_at end;
 phase_release:=greatest(raw_release,coalesce(c.automation_enabled_at,raw_release));
 if not p_revise and phase_release>p_now then continue; end if;
 key:=m->>'source_key'; keys:=array_append(keys,key); target:=m->'target_snapshot';
 material:=private.task_resolve_materials(p_user,c.id,m->'scope',m->'material_selector',target);
 deadline:=private.task_deadline(t->'deadline',c.default_deadline,to_jsonb(e),next_event,p_phase);
 if not p_revise and p_phase='before_class' and raw_release<c.automation_enabled_at and (deadline->>'due_at')::timestamptz<=c.automation_enabled_at then continue; end if;
 if raw_release>(deadline->>'due_at')::timestamptz then
 window_issue:=jsonb_build_object('code','release_after_deadline','source_key',key);
 update public.task_course_events set runtime_issues=runtime_issues||jsonb_build_array(window_issue) where id=e.id and not runtime_issues @> jsonb_build_array(window_issue);
 end if;
 selection:=case when c.subject='math' and t->>'mode'='checklist' and t->>'item_source'<>'class' then 'pending' else 'ready' end;
 new_items:='[]';
 if c.subject='math' and t->>'item_source'='class' then
 select coalesce(jsonb_agg(jsonb_build_object('id',v,'label',v,'done',false)),'[]') into new_items from jsonb_array_elements_text(coalesce(target->'problem_keys','[]')) v;
 if new_items='[]' then selection:='pending'; end if;
 elsif selection='ready' and t->>'progress_mode'='items' then
 select coalesce(jsonb_agg(jsonb_build_object('id','check:'||private.task_uri(coalesce(target->'lesson'->>'key',''))||':'||ord,'label',v,'done',false) order by ord),'[]') into new_items from jsonb_array_elements_text(t->'checklist') with ordinality x(v,ord);
 end if;
 select * into item from public.task_instances where user_id=p_user and source_key=key;
 if found then
 if not p_revise or item.status='completed' then continue; end if;
 changed:=coalesce(item.content_snapshot->'lesson'->>'key','') is distinct from coalesce(target->'lesson'->>'key','') or item.content_snapshot->'cursor' is distinct from target->'cursor' or item.content_snapshot->'problem_keys' is distinct from target->'problem_keys';
 insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(p_user,item.id,item.revision,'content_revision',jsonb_build_object('task',to_jsonb(item))) on conflict do nothing;
 select coalesce(jsonb_agg(v||jsonb_build_object('done',coalesce((select done from public.task_instance_items x where x.user_id=p_user and x.task_id=item.id and x.item_key=v->>'id'),false))),'[]') into new_items from jsonb_array_elements(new_items) v;
 update public.task_instances set title=(t->>'name')||case when target->'lesson'->>'title' is not null then ' · '||(target->'lesson'->>'title') else '' end,
 lesson=target->'lesson',content_snapshot=target,items=new_items,revision=revision+1,
 completion_percent=case when changed and progress_mode='percentage' then 0 else completion_percent end,
 status=case when status='cancelled' or (changed and progress_mode='percentage') then 'pending' else status end,
 -- Content/schedule revision is not an explicit original-deadline edit.
 due_at=case when item.due_at<=p_now then item.due_at else (deadline->>'due_at')::timestamptz end,
 due_kind=case when item.due_at<=p_now then item.due_kind else deadline->>'kind' end,template_snapshot=t||jsonb_build_object('resolved_deadline',deadline->'policy'),selection_state=selection,material_status=material->>'status',material_assets=material->'asset_ids' where id=item.id;
 taskid:=item.id;
 else
 insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,estimated_minutes,material_kind,template_snapshot,course_event_id,event_key,progress_mode,release_at,selection_state,material_status,material_assets,content_snapshot)
 values(p_user,(t->>'name')||case when target->'lesson'->>'title' is not null then ' · '||(target->'lesson'->>'title') else '' end,c.subject,c.id,e.occurrence_id,(t->>'id')::uuid,key,t->>'mode',new_items,target->'lesson',(deadline->>'due_at')::timestamptz,deadline->>'kind',(m->>'estimated_minutes')::int,t->>'material_kind',t||jsonb_build_object('resolved_deadline',deadline->'policy'),e.id,e.event_key,t->>'progress_mode',phase_release,selection,material->>'status',material->'asset_ids',target)
 on conflict(user_id,source_key) do nothing returning id into taskid;
 end if;
 if taskid is not null then
 update public.task_instance_items set cancelled=true where user_id=p_user and task_id=taskid and not(item_key in(select v->>'id' from jsonb_array_elements(new_items) v));
 insert into public.task_instance_items(user_id,task_id,item_key,label,done,sort_order)
 select p_user,taskid,v->>'id',v->>'label',coalesce((v->>'done')::boolean,false),ord::int from jsonb_array_elements(new_items) with ordinality x(v,ord)
 on conflict(user_id,task_id,item_key) do update set label=excluded.label,cancelled=false,sort_order=excluded.sort_order;
 end if;
 end loop;
 if p_revise then
 update public.task_instances set status='cancelled' where user_id=p_user and course_event_id=e.id and status<>'completed' and not(source_key=any(keys)) and ((template_snapshot->>'trigger'='before_class')=(p_phase='before_class'));
 update public.task_reminders set status='cancelled' where user_id=p_user and task_id in(select id from public.task_instances where user_id=p_user and course_event_id=e.id and status='cancelled') and status in ('pending','sending','failed');
 end if;
 update public.task_course_events set runtime_issues=runtime_issues||case when e.next_snapshot is null and exists(select 1 from public.task_course_pool_bindings b join public.task_templates t on t.user_id=b.user_id and t.id=b.pool_item_id where b.user_id=p_user and b.course_id=c.id and b.enabled and t.enabled and t.target='next') then '[{"code":"missing_next_lesson"}]'::jsonb else '[]'::jsonb end where id=e.id and not runtime_issues @> '[{"code":"missing_next_lesson"}]';
end $$;

commit;
