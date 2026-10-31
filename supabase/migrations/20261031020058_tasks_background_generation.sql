-- One event engine for cron, page catch-up and explicit completion. Local rollout only.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
alter table public.task_courses add column cursor_revision integer not null default 1,
 add column generation_date date, add column generation_state text not null default 'active' check(generation_state in ('active','paused','finished')),
 add column generation_issue jsonb;
alter table public.task_course_events add column after_processed boolean not null default false,
 add column cursor_advanced boolean not null default false, add column next_snapshot jsonb,
 add column runtime_issues jsonb not null default '[]', add column progression_result jsonb, add column content_origin text not null default 'cursor' check(content_origin in ('cursor','explicit'));
update public.task_course_events set after_processed=true,cursor_advanced=true where completion_state='completed';
-- Flexible activation may be later than midnight; it never acquires fictional clocks.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.task_course_events'::regclass and contype='c' and pg_get_constraintdef(oid) like '%release_at%on_date%' loop
 execute format('alter table public.task_course_events drop constraint %I',c.conname); end loop;
end $$;
alter table public.task_course_events add check((starts_at is null and release_at>=on_date::timestamp at time zone 'Asia/Shanghai' and release_at<(on_date+1)::timestamp at time zone 'Asia/Shanghai') or (starts_at is not null and release_at=ends_at));
alter table public.task_instances add column selection_state text not null default 'ready' check(selection_state in ('ready','pending','no_homework')),
 add column material_status text not null default 'not_required' check(material_status in ('not_required','pending','selected')),
 add column material_assets jsonb not null default '[]', add column content_snapshot jsonb;
alter table public.task_templates add constraint task_pool_inheritance_trigger check(deadline->>'kind'<>'course_default' or trigger not in ('once','weekly'));
create table private.task_worker_log(id bigint generated always as identity primary key,user_id uuid,started_at timestamptz not null default now(),finished_at timestamptz,processed integer,error text);
create table private.task_worker_state(user_id uuid primary key references auth.users(id) on delete cascade,last_run timestamptz,next_retry_at timestamptz,failures integer not null default 0);
create table private.task_event_revisions(id bigint generated always as identity primary key,user_id uuid not null,event_id uuid not null,revision integer not null,snapshot jsonb not null,created_at timestamptz not null default now());
create table private.task_runtime_config(singleton boolean primary key default true check(singleton),cron_enabled boolean not null,detail text not null);
insert into private.task_runtime_config values(true,false,'pg_cron is not installed; background generation is not enabled');

-- Identical to encodeURIComponent, including UTF-8, delimiters and JS safe punctuation.
create function private.task_uri(value text) returns text language plpgsql immutable set search_path='' as $$
declare bytes bytea:=convert_to(value,'UTF8'); result text:=''; b int; i int;
begin for i in 0..length(bytes)-1 loop b:=get_byte(bytes,i);
 if (b between 65 and 90) or (b between 97 and 122) or (b between 48 and 57) or b in (45,95,46,33,126,42,39,40,41) then result:=result||chr(b); else result:=result||'%'||upper(lpad(to_hex(b),2,'0')); end if;
 end loop; return result; end $$;
-- Adopt existing generated-task identities without deleting or resetting historical work.
-- Duplicate historical candidates stay readable; one canonical survivor prevents new emission.
with identities as (
 select i.id,i.user_id,i.status,'pool:'||private.task_uri(e.event_key)||':'||private.task_uri(coalesce(i.template_snapshot->>'activity_key',t.activity_key))||':'||private.task_uri(case when coalesce(i.template_snapshot->>'trigger',t.trigger)='confirmed' then 'after_class' else coalesce(i.template_snapshot->>'trigger',t.trigger) end)||':'||private.task_uri(coalesce(i.template_snapshot->>'target',t.target)) canonical
 from public.task_instances i join public.task_course_events e on e.user_id=i.user_id and e.id=i.course_event_id join public.task_templates t on t.user_id=i.user_id and t.id=i.template_id
 where i.source_key not like 'pool:%' and coalesce(i.template_snapshot->>'trigger',t.trigger) in ('before_class','after_class','confirmed','unit_completed')
), chosen as (select distinct on(user_id,canonical) * from identities order by user_id,canonical,(status='completed') desc,id)
update public.task_instances i set source_key=chosen.canonical from chosen where i.id=chosen.id and not exists(select 1 from public.task_instances already where already.user_id=chosen.user_id and already.source_key=chosen.canonical);

create function private.task_advance(s jsonb,c jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare pos int; segpos int; segments jsonb; next_lesson jsonb; segment jsonb;
begin
 select ord::int into pos from jsonb_array_elements(s->'ordered_lessons') with ordinality x(l,ord) where l->>'key'=c->>'lesson_key';
 if pos is null then raise exception 'invalid_course_cursor'; end if;
 if s->>'progression_mode'='segment' then
 select coalesce(jsonb_agg(v order by ord),'[]') into segments from jsonb_array_elements(s->'teaching_segments') with ordinality x(v,ord) where v->>'lesson_key'=c->>'lesson_key';
 select ord::int into segpos from jsonb_array_elements(segments) with ordinality x(v,ord) where v->>'key'=c->>'segment_key';
 if segpos is null then return jsonb_build_object('kind','missing_segment','lesson_key',c->>'lesson_key'); end if;
 if segments->segpos is not null then return jsonb_build_object('kind','next','cursor',jsonb_build_object('lesson_key',c->>'lesson_key','segment_key',segments->segpos->>'key')); end if;
 if not coalesce((segments->(segpos-1)->>'completes_lesson')::boolean,false) then return jsonb_build_object('kind','missing_segment','lesson_key',c->>'lesson_key'); end if;
 end if;
 next_lesson:=s->'ordered_lessons'->pos;
 if next_lesson is null then return '{"kind":"finished"}'; end if;
 if s->>'progression_mode'='segment' then
 select v into segment from jsonb_array_elements(s->'teaching_segments') v where v->>'lesson_key'=next_lesson->>'key' limit 1;
 if segment is null then return jsonb_build_object('kind','missing_segment','lesson_key',next_lesson->>'key'); end if; end if;
 return jsonb_build_object('kind','next','cursor',jsonb_build_object('lesson_key',next_lesson->>'key','segment_key',segment->>'key'));
end $$;
create function private.task_content(s jsonb,c jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when c is null then null else jsonb_build_object('lesson',(select v from jsonb_array_elements(s->'ordered_lessons') v where v->>'key'=c->>'lesson_key'),'cursor',c,'catalog_version',s->>'version','problem_keys',coalesce((select v->'problem_keys' from jsonb_array_elements(s->'teaching_segments') v where v->>'key'=c->>'segment_key'),'[]'),'segment_title',(select v->>'title' from jsonb_array_elements(s->'teaching_segments') v where v->>'key'=c->>'segment_key')) end
$$;
create function private.task_scope_matches(scope jsonb,content jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case scope->>'kind' when 'all' then true when 'lessons' then scope->'lesson_keys' ? (content->'lesson'->>'key') when 'segments' then scope->'segment_keys' ? (content->'cursor'->>'segment_key') when 'unit' then scope->>'book'=content->'lesson'->>'book' and scope->>'unit'=content->'lesson'->>'unit' else false end,false)
$$;
-- Task7 replaces this narrow resolver using canonical shared-material permissions.
-- Output: {status: pending|not_required|selected, asset_ids: string[]}; no private URLs.
create function private.task_resolve_materials(p_user uuid,p_course uuid,p_scope jsonb,p_selector jsonb,p_content jsonb) returns jsonb language sql stable set search_path='' as $$
 select case when p_selector->>'kind'='none' then '{"status":"not_required","asset_ids":[]}'::jsonb else '{"status":"pending","asset_ids":[]}'::jsonb end
$$;
create function private.task_matches(p_event jsonb,p_bindings jsonb,p_items jsonb,p_next jsonb,p_completed_unit jsonb) returns jsonb language sql immutable set search_path='' as $$
 with candidates as (
 select b,t,coalesce(nullif(b->'scope_override','null'),t->'scope') scope,
 case when t->>'target'='next' then p_next else p_event->'lesson_snapshot' end content
 from jsonb_array_elements(p_bindings) b join jsonb_array_elements(p_items) t on t->>'id'=b->>'pool_item_id'
 where b->>'course_id'=p_event->>'course_id' and b->>'user_id'=p_event->>'user_id' and t->>'user_id'=p_event->>'user_id'
 and (b->>'enabled')::boolean and (t->>'enabled')::boolean and t->>'trigger' not in ('weekly','once')
 and (t->>'trigger'<>'unit_completed' or (p_completed_unit->>'book'=p_event->'lesson_snapshot'->'lesson'->>'book' and p_completed_unit->>'unit'=p_event->'lesson_snapshot'->'lesson'->>'unit'))
 ), matched as (
 select *, 'pool:'||private.task_uri(p_event->>'event_key')||':'||private.task_uri(t->>'activity_key')||':'||private.task_uri(case when t->>'trigger'='confirmed' then 'after_class' else t->>'trigger' end)||':'||private.task_uri(t->>'target') source_key,
 (case scope->>'kind' when 'segments' then 3 when 'lessons' then 2 when 'unit' then 1 else 0 end)*2+case when nullif(b->'scope_override','null') is null and t->>'lesson_filter' is not null then 1 else 0 end specificity
 from candidates where private.task_scope_matches(scope,content) and (t->>'target'<>'next' or content->'lesson'->>'key' is not null)
 and (nullif(b->'scope_override','null') is not null or t->>'lesson_filter' is null or t->>'lesson_filter'=content->'lesson'->>'lesson')
 ), winners as (select distinct on(source_key) * from matched order by source_key,specificity desc,b->>'id')
 select coalesce(jsonb_agg(jsonb_build_object('source_key',source_key,'pool_item_id',t->>'id','binding_id',b->>'id','template',t,'target_snapshot',content,'scope',scope,'estimated_minutes',coalesce(nullif(b->'estimated_minutes_override','null'),t->'estimated_minutes'),'material_selector',coalesce(nullif(b->'material_override','null'),t->'material_selector'))),'[]') from winners
$$;
-- Every recurrence uses the rule's own historical kind, and the same Shanghai predicate.
create function private.task_candidates(p_user uuid,p_course uuid,p_from date,p_until date) returns table(event_key text,rule_id uuid,on_date date,starts_at timestamptz,ends_at timestamptz,release_at timestamptz,occurrence_id uuid) language sql stable set search_path='' as $$
 select distinct on(k) k,rid,d,st,en,rel,oid from (
 select coalesce(ev.event_key,case r.kind when 'flexible' then 'flexible:'||r.course_id||':'||g::date else 'timetabled:'||r.id||':'||g::date end) k,
 r.id rid,g::date d,case when r.kind='timetabled' then coalesce(ex.starts_at,(g::date+r.start_time) at time zone 'Asia/Shanghai') end st,
 case when r.kind='timetabled' then coalesce(ex.ends_at,(g::date+r.end_time) at time zone 'Asia/Shanghai') end en,
 case when r.kind='timetabled' then coalesce(ex.ends_at,(g::date+r.end_time) at time zone 'Asia/Shanghai') else greatest(g::date::timestamp at time zone 'Asia/Shanghai',coalesce(c.automation_enabled_at,g::date::timestamp at time zone 'Asia/Shanghai')) end rel,o.id oid
 from public.task_timetable_rules r join public.task_courses c on c.user_id=r.user_id and c.id=r.course_id
 cross join lateral (
 select value::date g from generate_series(p_from::timestamp,p_until::timestamp,interval '1 day') value
 union select moved.original_date from public.task_course_exceptions moved where moved.user_id=r.user_id and moved.rule_id=r.id and (moved.ends_at at time zone 'Asia/Shanghai')::date between p_from and p_until
 ) dates
 left join public.task_course_exceptions ex on ex.user_id=r.user_id and ex.rule_id=r.id and ex.original_date=g::date
 left join public.task_course_occurrences o on o.user_id=r.user_id and o.rule_id=r.id and o.original_date=g::date
 left join public.task_course_events ev on ev.user_id=o.user_id and ev.occurrence_id=o.id
 where r.user_id=p_user and r.course_id=p_course and c.archived_at is null and public.task_rule_occurs(r,g::date) and not coalesce(ex.cancelled,false)
 and (c.automation_enabled_at is null or case when r.kind='flexible' then g::date>=(c.automation_enabled_at at time zone 'Asia/Shanghai')::date else coalesce(ex.ends_at,(g::date+r.end_time) at time zone 'Asia/Shanghai')>=c.automation_enabled_at end)
 union all
 select e.event_key,e.rule_id,e.on_date,e.starts_at,e.ends_at,e.release_at,e.occurrence_id
 from public.task_course_events e join public.task_courses c on c.user_id=e.user_id and c.id=e.course_id
 where e.user_id=p_user and e.course_id=p_course and e.rule_id is null and e.assignment_state<>'cancelled' and c.archived_at is null
 and (e.release_at at time zone 'Asia/Shanghai')::date between p_from and p_until
 ) q order by k,rid
$$;
create function private.task_next_candidate(p_user uuid,p_course uuid,p_event jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare r public.task_timetable_rules; base date; horizon date; n jsonb; best jsonb; after_time timestamptz:=coalesce((p_event->>'starts_at')::timestamptz,(p_event->>'on_date')::date::timestamp at time zone 'Asia/Shanghai');
begin
 -- Full recurrence domain, not the timetable preview window. Finite weeks max 520.
 for r in select * from public.task_timetable_rules where user_id=p_user and course_id=p_course loop
 base:=greatest((after_time at time zone 'Asia/Shanghai')::date,r.valid_from);
 horizon:=least(coalesce(r.valid_until,'infinity'),coalesce(r.disabled_from-1,'infinity'),case r.recurrence when 'once' then r.anchor_date when 'weeks' then r.anchor_date+coalesce((select max(w) from unnest(r.teaching_weeks) w),0)*7 else base+r.interval_weeks*7*((select count(*) from public.task_course_exceptions where user_id=p_user and rule_id=r.id)+2)::int end);
 select to_jsonb(x) into n from private.task_candidates(p_user,p_course,base,horizon) x where x.rule_id=r.id and coalesce(x.starts_at,x.on_date::timestamp at time zone 'Asia/Shanghai')>after_time order by coalesce(x.starts_at,x.on_date::timestamp at time zone 'Asia/Shanghai'),x.event_key limit 1;
 if n is not null and (best is null or coalesce(n->>'starts_at',n->>'on_date')<coalesce(best->>'starts_at',best->>'on_date')) then best:=n; end if;
 end loop;
 select to_jsonb(x) into n from public.task_course_exceptions ex cross join lateral private.task_candidates(p_user,p_course,ex.original_date,ex.original_date) x
 where ex.user_id=p_user and ex.starts_at>after_time and x.rule_id=ex.rule_id and x.on_date=ex.original_date and x.starts_at>after_time
 order by x.starts_at,x.event_key limit 1;
 if n is not null and (best is null or coalesce(n->>'starts_at',n->>'on_date')<coalesce(best->>'starts_at',best->>'on_date')) then best:=n; end if;
 select to_jsonb(e) into n from public.task_course_events e where e.user_id=p_user and e.course_id=p_course and e.rule_id is null and e.assignment_state<>'cancelled'
 and coalesce(e.starts_at,e.on_date::timestamp at time zone 'Asia/Shanghai')>after_time order by coalesce(e.starts_at,e.on_date::timestamp at time zone 'Asia/Shanghai'),e.event_key limit 1;
 if n is not null and (best is null or coalesce(n->>'starts_at',n->>'on_date')<coalesce(best->>'starts_at',best->>'on_date')) then best:=n; end if;
 return best;
end $$;
create function private.task_deadline(p_pool jsonb,p_course jsonb,p_event jsonb,p_next jsonb,p_phase text) returns jsonb language plpgsql immutable set search_path='' as $$
declare policy jsonb:=p_pool; target jsonb; due timestamptz; anchor_date date;
begin
 if policy->>'kind'='course_default' then policy:=coalesce(nullif(p_course,'null'),'{"kind":"next_class","days":1,"time":"20:30","at":null}'); end if;
 target:=case when p_phase='before_class' then p_event else p_next end;
 anchor_date:=case when p_event->>'starts_at' is not null then (coalesce(p_event->>'release_at',p_event->>'ends_at',p_event->>'starts_at')::timestamptz at time zone 'Asia/Shanghai')::date else (p_event->>'on_date')::date end;
 due:=case policy->>'kind' when 'fixed' then (policy->>'at')::timestamptz
 when 'same_day' then (anchor_date::text||' '||(policy->>'time'))::timestamp at time zone 'Asia/Shanghai'
 when 'days_after' then ((anchor_date+(policy->>'days')::int)::text||' '||(policy->>'time'))::timestamp at time zone 'Asia/Shanghai'
 when 'next_class' then coalesce((target->>'starts_at')::timestamptz,(((target->>'on_date')::date-coalesce((policy->>'days')::int,1))::text||' '||coalesce(policy->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai') end;
 return jsonb_build_object('kind',policy->>'kind','due_at',due,'policy',policy);
end $$;
create function private.task_emit_event(p_user uuid,p_event uuid,p_phase text,p_now timestamptz,p_revise boolean default false) returns void language plpgsql set search_path='' as $$
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
 due_at=(deadline->>'due_at')::timestamptz,due_kind=deadline->>'kind',template_snapshot=t||jsonb_build_object('resolved_deadline',deadline->'policy'),selection_state=selection,material_status=material->>'status',material_assets=material->'asset_ids' where id=item.id;
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

create function private.task_finish_phase(p_user uuid,p_event uuid,p_now timestamptz,p_manual boolean default false) returns void language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; s jsonb; advancement jsonb;
begin
 select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
 select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
 if e.assignment_state='cancelled' or c.archived_at is not null then return; end if;
 if not p_manual and e.release_at>p_now then return; end if;
 if (c.auto_assign or p_manual) and (not e.after_processed or e.assignment_state='skipped' or e.assignment_state='pending') then
 perform private.task_emit_event(p_user,e.id,'after_class',p_now);
 update public.task_course_events set assignment_state='assigned' where id=e.id;
 elsif not e.after_processed then update public.task_course_events set assignment_state='skipped' where id=e.id; end if;
 if c.auto_advance and not e.cursor_advanced and (not e.after_processed or p_manual) and c.cursor is not null then
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 -- Advance the live cursor, never restore an old projected preview cursor.
 advancement:=private.task_advance(s,c.cursor);
 update public.task_courses set cursor=case when advancement->>'kind'='next' then advancement->'cursor' else cursor end,cursor_revision=cursor_revision+1,
 generation_state=case advancement->>'kind' when 'finished' then 'finished' when 'missing_segment' then 'paused' else 'active' end,
 generation_issue=case when advancement->>'kind'='missing_segment' then advancement else null end where id=c.id;
 update public.task_course_events set cursor_advanced=true where id=e.id;
 end if;
 update public.task_course_events set after_processed=true where id=e.id;
end $$;

create function private.task_materialize(p_user uuid,p_course uuid,p_candidate jsonb,p_cursor jsonb) returns uuid language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; s jsonb; next jsonb; content jsonb; oid uuid; progression jsonb;
begin
 select * into strict c from public.task_courses where user_id=p_user and id=p_course;
 select * into e from public.task_course_events where user_id=p_user and event_key=p_candidate->>'event_key';
 if found then return e.id; end if;
 oid:=(p_candidate->>'occurrence_id')::uuid;
 if p_candidate->>'starts_at' is not null and oid is null then
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at) values(p_user,p_course,(p_candidate->>'rule_id')::uuid,(p_candidate->>'on_date')::date,(p_candidate->>'starts_at')::timestamptz,(p_candidate->>'ends_at')::timestamptz)
 on conflict(user_id,rule_id,original_date) do update set starts_at=excluded.starts_at returning id into oid;
 end if;
 if c.catalog_snapshot_id is not null and p_cursor is not null then
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 content:=private.task_content(s,p_cursor); next:=private.task_advance(s,p_cursor); progression:=next;
 if next->>'kind'='next' then next:=private.task_content(s,next->'cursor'); else next:=null; end if;
 end if;
 insert into public.task_course_events(user_id,course_id,rule_id,occurrence_id,event_key,on_date,starts_at,ends_at,release_at,lesson_snapshot,next_snapshot,progression_result)
 values(p_user,p_course,(p_candidate->>'rule_id')::uuid,oid,p_candidate->>'event_key',(p_candidate->>'on_date')::date,(p_candidate->>'starts_at')::timestamptz,(p_candidate->>'ends_at')::timestamptz,(p_candidate->>'release_at')::timestamptz,content,next,progression) returning id into e.id;
 return e.id;
end $$;

create function private.task_process_due_user(p_user uuid,p_now timestamptz,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.task_courses; d date; today date:=(p_now at time zone 'Asia/Shanghai')::date; candidate record; eid uuid; used int:=0; more boolean:=false; s jsonb; projected jsonb; advancement jsonb; lead int; projected_count int;
begin
 if p_user is null or p_limit not between 1 and 1000 then raise exception 'invalid_worker_arguments'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 for c in select * from public.task_courses where user_id=p_user and archived_at is null order by coalesce(generation_date,(automation_enabled_at at time zone 'Asia/Shanghai')::date,today),id loop
 d:=coalesce(c.generation_date,(c.automation_enabled_at at time zone 'Asia/Shanghai')::date,today);
 while d<=today loop
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
 if used>=p_limit then continue; end if;
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

create function private.task_complete_event(p_user uuid,p_event uuid,p_expected_revision integer,p_now timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare e public.task_course_events;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 select * into strict e from public.task_course_events where id=p_event and user_id=p_user;
 if e.revision<>p_expected_revision then raise exception 'stale_event_revision'; end if;
 if e.assignment_state='cancelled' then raise exception 'event_cancelled'; end if;
 if e.completion_state='completed' then return to_jsonb(e); end if;
 perform private.task_finish_phase(p_user,e.id,p_now,true);
 update public.task_course_events set completion_state='completed',completed_at=p_now,revision=revision+1 where id=e.id returning * into e;
 if e.occurrence_id is not null then update public.task_course_occurrences set status='confirmed',confirmation=jsonb_build_object('lesson',e.lesson_snapshot->'lesson','next_lesson',e.next_snapshot->'lesson','class_items','[]'::jsonb,'homework_items','[]'::jsonb) where id=e.occurrence_id; end if;
 return to_jsonb(e);
end $$;
create or replace function public.task_complete_event(p_event_id uuid,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from public.task_course_events where user_id=u and id=p_event_id) then raise exception 'event_not_owned'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if (select revision from public.task_course_events where user_id=u and id=p_event_id)<>p_expected_revision then raise exception 'stale_event_revision'; end if;
 if (private.task_process_due_user(u,now(),100)->>'has_more')::boolean then return '{"status":"retry"}'; end if;
 return private.task_complete_event(u,p_event_id,p_expected_revision,now()); end $$;

create function private.task_revise_event(p_user uuid,p_event uuid,p_content jsonb,p_expected_revision integer,p_now timestamptz,p_explicit boolean default true) returns jsonb language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; s jsonb; cur jsonb; content jsonb; advancement jsonb; next jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
 if e.revision<>p_expected_revision then raise exception 'stale_event_revision'; end if;
 if e.assignment_state='cancelled' then raise exception 'event_cancelled'; end if;
 select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
 cur:=nullif(p_content->'cursor','null');
 if c.catalog_snapshot_id is not null then
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 if cur is null then raise exception 'invalid_course_cursor'; end if;
 advancement:=private.task_advance(s,cur); content:=private.task_content(s,cur);
 if content->'lesson' is null or (s->>'progression_mode'='segment' and not exists(select 1 from jsonb_array_elements(s->'teaching_segments') v where v->>'key'=cur->>'segment_key' and v->>'lesson_key'=cur->>'lesson_key')) then raise exception 'invalid_course_cursor'; end if;
 if advancement->>'kind'='next' then next:=private.task_content(s,advancement->'cursor'); end if;
 else
 if jsonb_typeof(p_content->'lesson') is distinct from 'object' or coalesce(p_content->'lesson'->>'key','')='' or coalesce(p_content->'lesson'->>'title','')='' then raise exception 'invalid_event_content'; end if;
 content:=jsonb_build_object('lesson',p_content->'lesson','cursor',null,'catalog_version',null,'problem_keys','[]'::jsonb);
 end if;
 insert into private.task_event_revisions(user_id,event_id,revision,snapshot) values(p_user,e.id,e.revision,to_jsonb(e));
 update public.task_course_events set lesson_snapshot=content,next_snapshot=next,progression_result=advancement,content_origin=case when p_explicit then 'explicit' else content_origin end,runtime_issues='[]',revision=revision+1 where id=e.id;
 if exists(select 1 from public.task_instances where user_id=p_user and course_event_id=e.id and template_snapshot->>'trigger'='before_class') then perform private.task_emit_event(p_user,e.id,'before_class',p_now,true); end if;
 if e.assignment_state='assigned' then perform private.task_emit_event(p_user,e.id,'after_class',p_now,true); end if;
 return (select to_jsonb(x) from public.task_course_events x where x.id=e.id);
end $$;
create function public.task_revise_event(p_event_id uuid,p_content jsonb,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from public.task_course_events where user_id=u and id=p_event_id) then raise exception 'event_not_owned'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if (select revision from public.task_course_events where user_id=u and id=p_event_id)<>p_expected_revision then raise exception 'stale_event_revision'; end if;
 if (private.task_process_due_user(u,now(),100)->>'has_more')::boolean then return '{"status":"retry"}'; end if;
 return private.task_revise_event(u,p_event_id,p_content,p_expected_revision,now()); end $$;

create function public.task_cancel_event(p_event_id uuid,p_expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.task_course_events; begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into strict e from public.task_course_events where user_id=u and id=p_event_id;
 if e.revision<>p_expected_revision then raise exception 'stale_event_revision'; end if;
 if e.completion_state='completed' then raise exception 'completed_event_history'; end if;
 update public.task_course_events set assignment_state='cancelled',revision=revision+1 where id=e.id;
 if e.rule_id is not null then
 insert into public.task_course_exceptions(user_id,rule_id,original_date,cancelled) values(u,e.rule_id,e.on_date,true) on conflict(user_id,rule_id,original_date) do update set cancelled=true;
 end if;
 update public.task_course_occurrences set status='cancelled' where user_id=u and id=e.occurrence_id;
 update public.task_instances set status='cancelled' where user_id=u and course_event_id=e.id and status<>'completed';
 update public.task_reminders set status='cancelled' where user_id=u and (occurrence_id=e.occurrence_id or task_id in(select id from public.task_instances where user_id=u and course_event_id=e.id)) and status in ('pending','sending','failed');
end $$;

-- Idempotent extra date-only event. Client supplies a stable request UUID, not a guessed clock.
create function public.task_makeup_event(p_course_id uuid,p_request_id uuid,p_on_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c public.task_courses; result_id uuid; candidate jsonb; begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into strict c from public.task_courses where user_id=u and id=p_course_id and archived_at is null;
 if p_request_id is null or p_on_date is null then raise exception 'invalid_makeup'; end if;
 if (private.task_process_due_user(u,now(),100)->>'has_more')::boolean then return null; end if;
 select * into c from public.task_courses where user_id=u and id=p_course_id;
 candidate:=jsonb_build_object('event_key','flexible:'||c.id||':'||p_on_date||':extra:'||p_request_id,'on_date',p_on_date,'release_at',p_on_date::timestamp at time zone 'Asia/Shanghai');
 result_id:=private.task_materialize(u,c.id,candidate,c.cursor); return result_id;
end $$;

create function private.task_reconcile_previews(p_user uuid,p_course uuid,p_now timestamptz) returns void language plpgsql set search_path='' as $$
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
 for candidate in select * from private.task_candidates(p_user,c.id,(p_now at time zone 'Asia/Shanghai')::date,coalesce((select max(on_date) from public.task_course_events where user_id=p_user and course_id=c.id and release_at>p_now),(p_now at time zone 'Asia/Shanghai')::date)) x where x.release_at>p_now order by x.release_at,x.event_key loop
 select * into e from public.task_course_events where user_id=p_user and event_key=candidate.event_key and assignment_state<>'cancelled';
 if found and not e.after_processed and e.completion_state='pending' and e.content_origin<>'explicit' and projected is not null then
 content:=private.task_content(s,projected);
 if e.lesson_snapshot is distinct from content then perform private.task_revise_event(p_user,e.id,jsonb_build_object('cursor',projected),e.revision,p_now,false); end if;
 end if;
 if c.auto_advance and projected is not null then advancement:=private.task_advance(s,projected); if advancement->>'kind'<>'next' then exit; end if; projected:=advancement->'cursor'; end if;
 end loop;
end $$;
create or replace function private.task_emit_independent(p_user uuid,p_template uuid,p_source text,p_occurrence uuid default null,p_lesson jsonb default null,p_items jsonb default null,p_anchor timestamptz default now(),p_course uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.task_templates; c public.task_course_occurrences; n public.task_course_occurrences; due timestamptz; task_id uuid; its jsonb; title text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 select * into t from public.task_templates where id=p_template and user_id=p_user and enabled;
 if not found or t.trigger not in ('weekly','once') then return; end if;
 if t.target='next' and p_lesson is null then return; end if;
 if p_occurrence is not null then select * into strict c from public.task_course_occurrences where id=p_occurrence and user_id=p_user; end if;
 if p_occurrence is not null then

   select * into n from public.task_course_occurrences where user_id=p_user and course_id=c.course_id and status<>'cancelled'
   and (case when t.trigger='before_class' then starts_at>=c.starts_at else starts_at>c.starts_at end) order by starts_at limit 1;
 end if;
 if p_occurrence is null and coalesce(p_course,t.course_id) is not null then

 select * into n from public.task_course_occurrences where user_id=p_user and course_id=coalesce(p_course,t.course_id) and status<>'cancelled' and starts_at>p_anchor order by starts_at limit 1;
 end if;
 due := case t.deadline->>'kind'
 when 'same_day' then (((p_anchor at time zone 'Asia/Shanghai')::date)::text||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
 when 'days_after' then ((((p_anchor at time zone 'Asia/Shanghai')::date+coalesce((t.deadline->>'days')::int,1))::text)||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
 when 'fixed' then (t.deadline->>'at')::timestamptz
 when 'next_class' then n.starts_at end;
 its:=p_items;
 if its is null then select coalesce(jsonb_agg(jsonb_build_object('id',ord::text,'label',v,'done',false) order by ord),'[]') into its from jsonb_array_elements_text(t.checklist) with ordinality x(v,ord); end if;
 if t.target='unit' and p_lesson is not null then p_lesson:=jsonb_build_object('key',(p_lesson->>'book')||':unit:'||(p_lesson->>'unit'),'title','第 '||(p_lesson->>'unit')||' 单元','book',p_lesson->>'book','unit',p_lesson->>'unit','kind','unit'); end if;
 title:=t.name||case when p_lesson is not null then ' · '||coalesce(p_lesson->>'title','') else '' end;
 insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,due_occurrence_id,estimated_minutes,material_kind,template_snapshot)
 values(p_user,title,coalesce(t.subject,'other'),coalesce(c.course_id,p_course,t.course_id),p_occurrence,t.id,p_source,t.mode,its,p_lesson,due,t.deadline->>'kind',case when t.deadline->>'kind'='next_class' then n.id end,t.estimated_minutes,t.material_kind,to_jsonb(t))
 on conflict(user_id,source_key) do nothing returning id into task_id;
end $$;

-- Prevent hard deletes through other client write paths as well.

create or replace function private.task_reconcile(p_user uuid,p_now timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare r public.task_timetable_rules; o public.task_course_occurrences; t public.task_templates; i public.task_instances; rr jsonb; d date; sub text; fire timestamptz; anchor timestamptz; due public.task_course_occurrences; rec record;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 for r in select * from public.task_timetable_rules where user_id=p_user and kind='timetabled' and course_id in (select id from public.task_courses where user_id=p_user and archived_at is null) loop
 for d in select g::date from generate_series(greatest(r.valid_from,(p_now at time zone 'Asia/Shanghai')::date-35),least(coalesce(r.valid_until,'infinity'::date),(p_now at time zone 'Asia/Shanghai')::date+35),interval '1 day') g where public.task_rule_occurs(r,g::date) and (g::date+r.end_time) at time zone 'Asia/Shanghai'>r.created_at loop
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at,status)
 select p_user,r.course_id,r.id,d,coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai'),coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai'),case when coalesce(e.cancelled,false) then 'cancelled' else 'scheduled' end
 from (select 1) dummy left join public.task_course_exceptions e on e.user_id=p_user and e.rule_id=r.id and e.original_date=d
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 end loop;
 -- Preserve confirmed occurrences and reconcile rule/exception changes per original date.
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'confirmed' and ends_at>p_now loop
 select * into r from public.task_timetable_rules where id=o.rule_id;
 select * into rec from public.task_course_exceptions where user_id=p_user and rule_id=o.rule_id and original_date=o.original_date;
 update public.task_course_occurrences set starts_at=coalesce(rec.starts_at,(o.original_date+r.start_time) at time zone 'Asia/Shanghai'),ends_at=coalesce(rec.ends_at,(o.original_date+r.end_time) at time zone 'Asia/Shanghai'),status=case when coalesce(rec.cancelled,false) or not public.task_rule_occurs(r,o.original_date) or exists(select 1 from public.task_courses c where c.id=o.course_id and c.user_id=p_user and c.archived_at is not null) then 'cancelled' else 'scheduled' end where id=o.id;
 end loop;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('weekly','once') loop
 if t.trigger='once' and t.scheduled_at<=p_now then perform private.task_emit_independent(p_user,t.id,'once:'||t.id,null,null,null,t.scheduled_at);
 elsif t.trigger='weekly' then
 for d in select g::date from generate_series(greatest((t.scheduled_at at time zone 'Asia/Shanghai')::date,(t.created_at at time zone 'Asia/Shanghai')::date,coalesce((t.generated_through at time zone 'Asia/Shanghai')::date,'-infinity'::date)),(p_now at time zone 'Asia/Shanghai')::date,interval '1 day') g where extract(dow from g)::int=any(t.weekdays) loop
 fire:=(d+(t.scheduled_at at time zone 'Asia/Shanghai')::time) at time zone 'Asia/Shanghai';
 if fire<=p_now then perform private.task_emit_independent(p_user,t.id,'weekly:'||t.id||':'||d,null,null,null,fire); end if;
 end loop;
 end if;
 update public.task_templates set generated_through=p_now where id=t.id;
 end loop;
 -- Formal relative deadlines use immutable event phase and resolved policy.
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and due_kind='next_class' and course_event_id is not null and (due_at is null or due_at>p_now) loop
 select * into rec from public.task_course_events where user_id=p_user and id=i.course_event_id;
 update public.task_instances set due_at=(private.task_deadline(coalesce(i.template_snapshot->'resolved_deadline',i.template_snapshot->'deadline'),null,to_jsonb(rec),private.task_next_candidate(p_user,i.course_id,to_jsonb(rec)),i.template_snapshot->>'trigger')->>'due_at')::timestamptz where id=i.id;
 end loop;
 update public.task_reminders set status='cancelled' where user_id=p_user and source_key like 'confirm:%' and status in ('pending','sending','failed');
 for rec in select id from public.task_courses where user_id=p_user loop perform private.task_reconcile_previews(p_user,rec.id,p_now); end loop;
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and template_id is not null loop
 select * into t from jsonb_populate_record(null::public.task_templates,i.template_snapshot);
 select * into o from public.task_course_occurrences where id=i.occurrence_id;
 for rr in select * from jsonb_array_elements(t.reminders) loop
 anchor:=case rr->>'anchor' when 'course_start' then o.starts_at when 'course_end' then o.ends_at else i.due_at end;
 if anchor is null then continue; end if;
 fire:=anchor+make_interval(mins=>(rr->>'minutes')::int);
 insert into public.task_reminders(user_id,task_id,occurrence_id,source_key,title,remind_at,expires_at)
 values(p_user,i.id,i.occurrence_id,i.id||':'||(rr->>'anchor')||':'||(rr->>'minutes'),i.title,fire,case when rr->>'anchor'='course_start' then o.starts_at end)
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title where task_reminders.status='pending';
 end loop;
 end loop;
 insert into public.task_reminders(user_id,occurrence_id,source_key,title,remind_at,expires_at)
 select p_user,occ_row.id,'course-start:'||occ_row.id,'即将上课：'||c.name,occ_row.starts_at-make_interval(mins=>c.reminder_minutes),case when c.reminder_minutes=0 then occ_row.ends_at else occ_row.starts_at end
 from public.task_course_occurrences occ_row join public.task_courses c on c.id=occ_row.course_id and c.user_id=occ_row.user_id
 where occ_row.user_id=p_user and occ_row.status='scheduled' and occ_row.ends_at>p_now and (c.reminder_minutes=0 or occ_row.starts_at>p_now) and c.archived_at is null and c.reminder_minutes is not null
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 insert into public.task_reminders(user_id,exam_id,source_key,title,remind_at,expires_at)
 select p_user,e.id,'exam:'||e.id,'即将考试：'||e.title,e.starts_at-make_interval(mins=>e.reminder_minutes),e.ends_at
 from public.task_exams e where e.user_id=p_user and e.ends_at>p_now and e.reminder_minutes is not null
 and (e.course_id is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is null))
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.source_key like 'course-start:%' and exists(select 1 from public.task_course_occurrences occ_row join public.task_courses c on c.id=occ_row.course_id and c.user_id=occ_row.user_id where occ_row.id=rem.occurrence_id and occ_row.user_id=p_user and (c.reminder_minutes is null or c.archived_at is not null)))
 or (rem.exam_id is not null and exists(select 1 from public.task_exams e where e.id=rem.exam_id and e.user_id=p_user and (e.reminder_minutes is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is not null)))));
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=p_now)
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $$;



create or replace function public.task_emit(p_user uuid,p_template uuid,p_source text,p_occurrence uuid default null,p_lesson jsonb default null,p_items jsonb default null,p_anchor timestamptz default now(),p_course uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.task_assert_owner(p_user);
 if p_occurrence is not null or p_course is not null then raise exception 'use_course_event_runtime'; end if;
 perform private.task_emit_independent(p_user,p_template,p_source,null,p_lesson,p_items,p_anchor,null);
end $$;
create or replace function public.task_tick(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>p_user then raise exception 'unauthorized'; end if;
 perform private.task_reconcile(p_user,now());
 perform private.task_process_due_user(p_user,now(),100);
 perform private.task_reconcile(p_user,now());
end $$;
create or replace function public.task_course_before_configuration_change(p_user uuid,p_course uuid) returns void language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if auth.uid() is null or auth.uid()<>p_user then raise exception 'unauthorized'; end if;
 result:=private.task_process_due_user(p_user,now(),100);
 perform set_config('task.catchup_pending',coalesce(result->>'has_more','false'),true);
end $$;
create or replace function public.task_save_course(p_course jsonb,p_rules jsonb,p_effective_from date default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; rid uuid; old_rid uuid; is_new boolean; rule_start date; item jsonb; old_rule public.task_timetable_rules; new_rule public.task_timetable_rules; effective date:=coalesce(p_effective_from,(now() at time zone 'Asia/Shanghai')::date); seen uuid[]:='{}'; prior public.task_courses; snapshot public.task_course_catalog_snapshots; proposed jsonb; sid uuid; binding jsonb; binding_ids uuid[]:='{}'; bid uuid; kind text; cur jsonb; resume_result jsonb;
begin
 perform public.task_user_lock(u);
 if jsonb_typeof(p_course) is distinct from 'object' then raise exception 'invalid_course'; end if;
 if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 100 then raise exception 'invalid_rules'; end if;
 if effective<(now() at time zone 'Asia/Shanghai')::date then raise exception 'invalid_effective_date'; end if;
 cid:=nullif(p_course->>'id','')::uuid;
 is_new:=cid is null;
 kind:=coalesce(p_course->>'course_type','timetabled');
 if kind not in ('timetabled','flexible') then raise exception 'invalid_course_type'; end if;
 if cid is not null then
 select * into prior from public.task_courses where user_id=u and id=cid for update;
 if not found then raise exception 'course_not_owned'; end if;
 if (p_course->>'rules_revision')::int is distinct from prior.rules_revision then raise exception 'stale_course_revision'; end if;
 if prior.archived_at is not null then raise exception 'course_archived'; end if;
 if p_course ? 'cursor' and (p_course->>'expected_cursor_revision')::int is distinct from prior.cursor_revision then raise exception 'stale_cursor_revision'; end if;
 end if;
 -- Task4 replaces this pre-mutation hook with due-event catch-up under the same lock.
 perform public.task_course_before_configuration_change(u,cid);
 if current_setting('task.catchup_pending',true)='true' then return null; end if;
 -- Hook may advance the cursor; never restore the pre-hook full draft.
 if cid is not null then select * into prior from public.task_courses where user_id=u and id=cid; end if;
 proposed:=nullif(p_course->'catalog_snapshot','null'::jsonb);
 sid:=case when p_course ? 'catalog_snapshot_id' then nullif(p_course->>'catalog_snapshot_id','')::uuid else prior.catalog_snapshot_id end;
 if proposed is not null then
 if proposed->>'user_id' is distinct from u::text or proposed->>'subject' is distinct from p_course->>'subject' then raise exception 'snapshot_owner_or_subject_mismatch'; end if;
 if jsonb_typeof(proposed->'ordered_lessons') is distinct from 'array' or jsonb_array_length(proposed->'ordered_lessons')=0
 or jsonb_typeof(proposed->'teaching_segments') is distinct from 'array' then raise exception 'invalid_catalog_snapshot'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'ordered_lessons') l where coalesce(l->>'key','')='' or coalesce(l->>'title','')='')
 or (select count(*) from jsonb_array_elements(proposed->'ordered_lessons'))<>(select count(distinct l->>'key') from jsonb_array_elements(proposed->'ordered_lessons') l)
 then raise exception 'invalid_catalog_lessons'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') s where coalesce(s->>'key','')='' or coalesce(s->>'title','')='' or jsonb_typeof(s->'problem_keys') is distinct from 'array' or not exists(select 1 from jsonb_array_elements(proposed->'ordered_lessons') l where l->>'key'=s->>'lesson_key'))
 or (select count(*) from jsonb_array_elements(proposed->'teaching_segments'))<>(select count(distinct s->>'key') from jsonb_array_elements(proposed->'teaching_segments') s) then raise exception 'invalid_catalog_segments'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') s where (s ? 'completes_lesson' and jsonb_typeof(s->'completes_lesson')<>'boolean')
 or exists(select 1 from jsonb_array_elements(s->'problem_keys') p where jsonb_typeof(p)<>'string' or length(p#>>'{}')=0)
 or (select count(*) from jsonb_array_elements(s->'problem_keys'))<>(select count(distinct p) from jsonb_array_elements(s->'problem_keys') p)) then raise exception 'invalid_segment_problems'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') with ordinality a(s,n) join jsonb_array_elements(proposed->'teaching_segments') with ordinality b(s,n) on a.s->>'lesson_key'=b.s->>'lesson_key' and a.n<b.n where coalesce((a.s->>'completes_lesson')::boolean,false)) then raise exception 'premature_lesson_completion'; end if;
 select * into snapshot from public.task_course_catalog_snapshots where user_id=u and subject=p_course->>'subject' and version=proposed->>'version';
 if found then
 if snapshot.source is distinct from proposed->>'source' or snapshot.progression_mode is distinct from proposed->>'progression_mode' or snapshot.ordered_lessons is distinct from proposed->'ordered_lessons' or snapshot.teaching_segments is distinct from proposed->'teaching_segments' then raise exception 'snapshot_version_content_mismatch'; end if;
 sid:=snapshot.id;
 else
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments)
 values(u,p_course->>'subject',proposed->>'version',proposed->>'source',proposed->>'progression_mode',proposed->'ordered_lessons',proposed->'teaching_segments') returning id into sid;
 end if;
 end if;
 if sid is not null then
 select * into snapshot from public.task_course_catalog_snapshots where user_id=u and id=sid and subject=p_course->>'subject';
 if not found then raise exception 'snapshot_not_owned_or_subject_mismatch'; end if;
 end if;
 cur:=case when p_course ? 'cursor' then nullif(p_course->'cursor','null'::jsonb) else prior.cursor end;
 if cur is not null and (jsonb_typeof(cur) is distinct from 'object' or sid is null or not exists(select 1 from jsonb_array_elements(snapshot.ordered_lessons) l where l->>'key'=cur->>'lesson_key')
 or (snapshot.progression_mode='segment' and not exists(select 1 from jsonb_array_elements(snapshot.teaching_segments) s where s->>'key'=cur->>'segment_key' and s->>'lesson_key'=cur->>'lesson_key'))
 or (snapshot.progression_mode='lesson' and cur->>'segment_key' is not null)) then raise exception 'invalid_course_cursor'; end if;
 if p_course->>'cursor_intent'='resume' then
 if prior.generation_state<>'paused' or prior.generation_issue->>'kind'<>'missing_segment' or prior.cursor is distinct from cur or snapshot.progression_mode<>'segment'
 or not exists(select 1 from public.task_course_events where user_id=u and course_id=cid and cursor_advanced and lesson_snapshot->'cursor'=prior.cursor)
 then raise exception 'invalid_resume_intent'; end if;
 resume_result:=private.task_advance(to_jsonb(snapshot),cur);
 if resume_result->>'kind'='next' then cur:=resume_result->'cursor'; end if;
 elsif p_course ? 'cursor_intent' and p_course->>'cursor_intent'<>'set' then raise exception 'invalid_cursor_intent'; end if;
 if coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false) and (sid is null or cur is null) then raise exception 'automation_requires_catalog_cursor'; end if;
 if cid is null then
 insert into public.task_courses(user_id,name,subject) values(u,p_course->>'name',p_course->>'subject') returning id into cid;
 elsif not exists(select 1 from public.task_courses where user_id=u and id=cid) then raise exception 'course_not_owned'; end if;
 update public.task_courses set name=p_course->>'name',subject=p_course->>'subject',calendar_id=nullif(p_course->>'calendar_id','')::uuid,
 teacher=coalesce(p_course->>'teacher',''),location=coalesce(p_course->>'location',''),credits=nullif(p_course->>'credits','')::numeric,
 notes=coalesce(p_course->>'notes',''),color=coalesce(p_course->>'color','#39765c'),reminder_minutes=case when p_course ? 'reminder_minutes' then (p_course->>'reminder_minutes')::int else 10 end
 where user_id=u and id=cid;
 update public.task_courses set course_type=kind, auto_assign=coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false), auto_advance=coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false),
 default_deadline=case when p_course ? 'default_deadline' then nullif(p_course->'default_deadline','null'::jsonb) else prior.default_deadline end,
 catalog_snapshot_id=sid,cursor=cur,
 cursor_revision=case when is_new then 1 else prior.cursor_revision+case when p_course ? 'cursor' then 1 else 0 end end,
 generation_date=case when prior.generation_state in ('paused','finished') and (p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id) then (now() at time zone 'Asia/Shanghai')::date when prior.automation_enabled_at is null then null else prior.generation_date end,
 generation_state=case when resume_result->>'kind'='missing_segment' then 'paused' when resume_result->>'kind'='finished' then 'finished' when p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id then 'active' else coalesce(prior.generation_state,'active') end,
 generation_issue=case when resume_result->>'kind'='missing_segment' then resume_result when p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id then null else prior.generation_issue end,
 rules_revision=coalesce(prior.rules_revision,0)+1,effective_from=effective,
 automation_enabled_at=case when (coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false) or coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false)) then coalesce(prior.automation_enabled_at,now()) else null end
 where user_id=u and id=cid;
 -- A pending revision can move again without stranding the still-valid earlier rules.
 if not is_new and prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and prior.effective_from<>effective then
 update public.task_timetable_rules set disabled_from=effective
 where user_id=u and course_id=cid and disabled_from=prior.effective_from and valid_from<prior.effective_from;
 end if;
 for item in select * from jsonb_array_elements(p_rules) loop
 if coalesce(item->>'kind',kind)<>kind then raise exception 'course_rule_type_mismatch'; end if;
 if kind='flexible' and (item->>'start_time' is not null or item->>'end_time' is not null) then raise exception 'flexible_rule_has_time'; end if;
 if item ? 'teaching_weeks' and jsonb_typeof(item->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(item->>'recurrence','weekly')='weeks' and (jsonb_typeof(item->'teaching_weeks') is distinct from 'array' or jsonb_array_length(item->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 rid:=nullif(item->>'id','')::uuid;
 old_rid:=rid;
 rule_start:=case when is_new then (item->>'valid_from')::date when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and (item->>'valid_from')::date=prior.effective_from then effective else greatest(effective,(item->>'valid_from')::date) end;
 if rid is not null then
 select * into strict old_rule from public.task_timetable_rules where user_id=u and id=rid and course_id=cid;
 -- Keep unchanged rules and their exception/occurrence identities intact.
 if not (coalesce(prior.effective_from>(now() at time zone 'Asia/Shanghai')::date,false) and prior.effective_from<>effective and old_rule.valid_from=prior.effective_from) and old_rule.weekday=(item->>'weekday')::int and old_rule.kind=kind and old_rule.start_time is not distinct from (item->>'start_time')::time and old_rule.end_time is not distinct from (item->>'end_time')::time
 and old_rule.valid_from=(item->>'valid_from')::date and old_rule.valid_until is not distinct from (item->>'valid_until')::date
 and old_rule.recurrence=coalesce(item->>'recurrence','weekly') and old_rule.interval_weeks=coalesce((item->>'interval_weeks')::int,1)
 and old_rule.anchor_date=coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date)
 and old_rule.teaching_weeks=array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int) and old_rule.disabled_from is null then
 seen:=array_append(seen,rid); continue;
 end if;
 if exists(select 1 from public.task_course_occurrences where user_id=u and rule_id=rid and original_date=rule_start and status='confirmed') then rule_start:=rule_start+1; end if;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and id=rid;
 end if;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks)
 values(u,cid,kind,(item->>'weekday')::int,(item->>'start_time')::time,(item->>'end_time')::time,rule_start,(item->>'valid_until')::date,
 coalesce(item->>'recurrence','weekly'),coalesce((item->>'interval_weeks')::int,1),coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int)) returning id into rid;
 -- Carry forward actual future class/task identities when a replacement still has
 -- a class in the same teaching week (including weekday moves).
 if old_rid is not null and old_rule.kind='timetabled' and kind='timetabled' then
 select * into new_rule from public.task_timetable_rules where id=rid and user_id=u;
 update public.task_course_exceptions e set rule_id=rid,
 original_date=e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7)
 where e.user_id=u and e.rule_id=old_rid and e.original_date>=effective
 and coalesce(e.ends_at,((e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai')>now()
 and public.task_rule_occurs(new_rule,e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))
 and not exists(select 1 from public.task_course_occurrences o where o.user_id=u and o.rule_id=old_rid and o.original_date=e.original_date and (o.status='confirmed' or o.ends_at<=now()));
 update public.task_course_occurrences o set rule_id=rid,
 original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7)
 where o.user_id=u and o.rule_id=old_rid and o.original_date>=effective and o.status<>'confirmed' and o.ends_at>now()
 and (((o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai'>now()
 or exists(select 1 from public.task_course_exceptions moved where moved.user_id=u and moved.rule_id=rid and moved.original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7) and moved.ends_at>now()))
 and public.task_rule_occurs(new_rule,o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7));
 end if;
 seen:=array_append(seen,rid);
 end loop;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and course_id=cid and not(id=any(seen));
 if p_course ? 'bindings' then
 if jsonb_typeof(p_course->'bindings') is distinct from 'array' or jsonb_array_length(p_course->'bindings')>500 then raise exception 'invalid_bindings'; end if;
 for binding in select * from jsonb_array_elements(p_course->'bindings') loop
 if not exists(select 1 from public.task_templates where user_id=u and id=(binding->>'pool_item_id')::uuid and trigger in ('before_class','after_class','confirmed','unit_completed') and (subject is null or subject=p_course->>'subject')) then raise exception 'invalid_pool_binding'; end if;
 if (binding->>'pool_item_id')::uuid=any(binding_ids) then raise exception 'duplicate_pool_binding'; end if;
 binding_ids:=array_append(binding_ids,(binding->>'pool_item_id')::uuid);
 bid:=nullif(binding->>'id','')::uuid;
 if bid is not null and not exists(select 1 from public.task_course_pool_bindings where user_id=u and id=bid and course_id=cid and pool_item_id=(binding->>'pool_item_id')::uuid) then raise exception 'binding_not_owned'; end if;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id,enabled,scope_override,estimated_minutes_override,material_override)
 values(u,cid,(binding->>'pool_item_id')::uuid,coalesce((binding->>'enabled')::boolean,true),nullif(binding->'scope_override','null'::jsonb),(binding->>'estimated_minutes_override')::int,nullif(binding->'material_override','null'::jsonb))
 on conflict(user_id,course_id,pool_item_id) do update set enabled=excluded.enabled,scope_override=excluded.scope_override,estimated_minutes_override=excluded.estimated_minutes_override,material_override=excluded.material_override;
 end loop;
 delete from public.task_course_pool_bindings where user_id=u and course_id=cid and not(pool_item_id=any(binding_ids));
 end if;
 perform public.task_tick(u); return cid;
end $$;


create function public.task_set_course_progress(p_course_id uuid,p_cursor jsonb,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c public.task_courses; s jsonb; result jsonb; advancement jsonb;
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into strict c from public.task_courses where user_id=u and id=p_course_id and archived_at is null;
 if c.cursor_revision<>p_expected_revision then raise exception 'stale_cursor_revision'; end if;
 result:=private.task_process_due_user(u,now(),100);
 if (result->>'has_more')::boolean then return '{"status":"retry"}'; end if;
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=u and x.id=c.catalog_snapshot_id;
 if p_cursor is null or s is null then raise exception 'invalid_course_cursor'; end if;
 advancement:=private.task_advance(s,p_cursor);
 if s->>'progression_mode'='segment' and not exists(select 1 from jsonb_array_elements(s->'teaching_segments') v where v->>'key'=p_cursor->>'segment_key' and v->>'lesson_key'=p_cursor->>'lesson_key') then raise exception 'invalid_course_cursor'; end if;
 update public.task_courses set cursor=p_cursor,cursor_revision=cursor_revision+1,generation_state='active',generation_issue=null,generation_date=(now() at time zone 'Asia/Shanghai')::date where id=c.id;
 perform private.task_reconcile_previews(u,c.id,now());
 return jsonb_build_object('status','updated','cursor_revision',(select cursor_revision from public.task_courses where id=c.id));
end $$;
-- Compatibility wrappers cannot revive subject-wide/template-course emission.
create or replace function public.task_confirm_course(p_occurrence uuid,p_confirmation jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.task_course_events; o public.task_course_occurrences; eid uuid;
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into strict o from public.task_course_occurrences where user_id=u and id=p_occurrence;
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
create or replace function public.task_update_preview(p_occurrence uuid,p_lesson jsonb) returns int language plpgsql set search_path='' as $$ begin raise exception 'use_task_set_course_progress'; end $$;
create or replace function public.task_backfill(p_course uuid,p_lessons jsonb) returns void language plpgsql set search_path='' as $$ begin raise exception 'use_explicit_course_events'; end $$;
create or replace function public.task_check_units(p_user uuid,p_course uuid) returns void language plpgsql set search_path='' as $$ begin perform public.task_assert_owner(p_user); end $$;

create function private.task_run_due(p_now timestamptz default now(),p_users integer default 20,p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare row record; result jsonb; logid bigint; succeeded int:=0; failed int:=0;
begin
 if p_users not between 1 and 100 or p_limit not between 1 and 1000 then raise exception 'invalid_worker_arguments'; end if;
 insert into private.task_worker_state(user_id) select user_id from public.task_courses union select user_id from public.task_templates on conflict do nothing;
 for row in select * from private.task_worker_state where coalesce(next_retry_at,'-infinity')<=p_now order by last_run nulls first,user_id limit p_users for update skip locked loop
 insert into private.task_worker_log(user_id,started_at) values(row.user_id,p_now) returning id into logid;
 begin
 perform private.task_reconcile(row.user_id,p_now);
 result:=private.task_process_due_user(row.user_id,p_now,p_limit);
 perform private.task_reconcile(row.user_id,p_now);
 update private.task_worker_state set last_run=p_now,next_retry_at=null,failures=0 where user_id=row.user_id;
 update private.task_worker_log set finished_at=clock_timestamp(),processed=(result->>'processed')::int where id=logid;
 succeeded:=succeeded+1;
 exception when others then
 update private.task_worker_state set last_run=p_now,next_retry_at=p_now+make_interval(secs=>least(3600,60*(row.failures+1))),failures=failures+1 where user_id=row.user_id;
 update private.task_worker_log set finished_at=clock_timestamp(),error=sqlstate||':'||sqlerrm where id=logid; failed:=failed+1;
 end;
 end loop;
 delete from private.task_worker_log where started_at<p_now-interval '30 days';
 return jsonb_build_object('succeeded',succeeded,'failed',failed);
end $$;
create function public.task_runtime_status() returns jsonb language sql security definer set search_path='' as $$
 select case when auth.uid() is null then null else jsonb_build_object('cron_enabled',cron_enabled,'detail',detail) end from private.task_runtime_config where singleton
$$;
-- Explicitly narrow control-plane privileges. Public wrappers verify the signed-in owner.
revoke insert,update,delete on public.task_course_events from authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'task_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig); execute format('grant execute on function %s to service_role',f.sig); end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('task_complete_event','task_revise_event','task_cancel_event','task_makeup_event','task_set_course_progress','task_runtime_status') loop
 execute format('revoke all on function %s from public,anon',f.sig); execute format('grant execute on function %s to authenticated,service_role',f.sig); end loop;
end $$;
revoke all on all tables in schema private from public,anon,authenticated;
grant all on all tables in schema private to service_role;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
 execute $job$select cron.schedule('tasks-background-generation','* * * * *','select private.task_run_due();')$job$;
 update private.task_runtime_config set cron_enabled=true,detail='tasks-background-generation scheduled every minute';
 else raise notice 'Tasks background generation requires pg_cron; task_tick remains the same-engine catch-up entry'; end if;
end $$;
-- Owner-checked control-plane entry points own writes after browser DML is revoked.
alter function public.task_save_course(jsonb,jsonb,date) security definer;
alter function public.task_initialize(jsonb) security definer;
alter function public.task_import_timetable(jsonb,uuid,text,text) security definer;
create or replace function public.task_replace_rule(p_rule uuid,p_from date,p_weekday int,p_start time,p_end time,p_until date default null) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.task_timetable_rules; c public.task_courses; rules jsonb; result uuid;
begin
 perform public.task_user_lock(u);
 select * into strict r from public.task_timetable_rules where user_id=u and id=p_rule;
 select * into strict c from public.task_courses where user_id=u and id=r.course_id;
 select jsonb_agg(case when x.id=r.id then to_jsonb(x)||jsonb_build_object('weekday',p_weekday,'start_time',p_start,'end_time',p_end,'valid_until',p_until) else to_jsonb(x) end) into rules from public.task_timetable_rules x where x.user_id=u and x.course_id=c.id and x.disabled_from is null;
 result:=public.task_save_course(to_jsonb(c)-'cursor',rules,p_from);
 if result is null then raise exception 'catch_up_required'; end if;
end $$;
alter table public.task_course_events add column cancellation_reason text;
create function public.task_archive_course_runtime(p_course uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if not exists(select 1 from public.task_courses where user_id=u and id=p_course) then raise exception 'course_not_owned'; end if;
 result:=private.task_process_due_user(u,now(),100);
 if (result->>'has_more')::boolean then return '{"status":"retry"}'; end if;
 update public.task_courses set archived_at=coalesce(archived_at,now()),rules_revision=rules_revision+1 where user_id=u and id=p_course;
 update public.task_course_events set assignment_state='cancelled',cancellation_reason='archived',revision=revision+1 where user_id=u and course_id=p_course and release_at>now() and completion_state='pending' and assignment_state<>'cancelled';
 update public.task_course_occurrences set status='cancelled' where user_id=u and course_id=p_course and starts_at>now() and status='scheduled';
 update public.task_reminders set status='cancelled' where user_id=u and status in ('pending','sending','failed') and (occurrence_id in(select id from public.task_course_occurrences where user_id=u and course_id=p_course) or task_id in(select id from public.task_instances where user_id=u and course_id=p_course));
 return '{"status":"updated"}';
end $$;
create or replace function public.task_archive_course(p_course uuid) returns void language plpgsql security definer set search_path='' as $$
declare result jsonb; begin result:=public.task_archive_course_runtime(p_course); if result->>'status'='retry' then raise exception 'catch_up_required'; end if; end $$;
create function public.task_restore_course(p_course uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 update public.task_courses set archived_at=null,rules_revision=rules_revision+1,generation_date=(now() at time zone 'Asia/Shanghai')::date,automation_enabled_at=case when auto_assign or auto_advance then now() else null end where user_id=u and id=p_course and archived_at is not null;
 if not found then raise exception 'course_not_archived_or_owned'; end if;
 update public.task_course_events set assignment_state='pending',cancellation_reason=null,revision=revision+1 where user_id=u and course_id=p_course and release_at>now() and cancellation_reason='archived';
 perform public.task_tick(u);
end $$;
revoke insert,update,delete on public.task_courses,public.task_timetable_rules,public.task_course_catalog_snapshots from authenticated;
revoke all on function public.task_archive_course_runtime(uuid),public.task_restore_course(uuid) from public,anon;
grant execute on function public.task_archive_course_runtime(uuid),public.task_restore_course(uuid) to authenticated,service_role;

commit;
