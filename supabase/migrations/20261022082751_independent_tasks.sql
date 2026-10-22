-- Independent task management. No writes to existing subject plans or mastery tables.
create table public.task_courses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), subject text not null check(subject in ('chinese','math','english','dance','piano','swimming','other')),
 created_at timestamptz not null default now(), unique(user_id,id)
);
create table public.task_timetable_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null,
 weekday int not null check(weekday between 0 and 6), start_time time not null, end_time time not null,
 valid_from date not null, valid_until date, check(end_time>start_time), check(valid_until is null or valid_until>=valid_from-1),
 unique(user_id,id), foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade
);
create table public.task_course_exceptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), rule_id uuid not null,
 original_date date not null, cancelled boolean not null default false, starts_at timestamptz, ends_at timestamptz,
 check(cancelled or (starts_at is not null and ends_at>starts_at)), unique(user_id,rule_id,original_date),
 foreign key(user_id,rule_id) references public.task_timetable_rules(user_id,id) on delete cascade
);
create table public.task_course_occurrences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null, rule_id uuid not null,
 original_date date not null, starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','confirmed','cancelled')), confirmation jsonb,
 check(ends_at>starts_at), unique(user_id,id), unique(user_id,rule_id,original_date),
 foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade,
 foreign key(user_id,rule_id) references public.task_timetable_rules(user_id,id) on delete cascade
);
create table public.task_templates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), name text not null check(length(name)>0),
 subject text, course_id uuid, enabled boolean not null default true,
 mode text not null check(mode in ('checklist','reading','audio')),
 trigger text not null check(trigger in ('before_class','after_class','confirmed','unit_completed','weekly','once')),
 target text not null check(target in ('current','next','unit')), checklist jsonb not null default '[]',
 estimated_minutes int not null default 20 check(estimated_minutes between 1 and 1440),
 deadline jsonb not null, reminders jsonb not null default '[]', trigger_minutes int not null default 0 check(trigger_minutes between 0 and 525600),
 weekdays int[] not null default '{1}', scheduled_at timestamptz, lesson_filter int check(lesson_filter between 1 and 3),
 material_kind text not null default 'general' check(material_kind in ('general','reading','dictation','recitation')),
 item_source text not null default 'template' check(item_source in ('template','class','homework')),
 created_at timestamptz not null default now(), generated_through timestamptz, unique(user_id,id),
 foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade,
 check(jsonb_typeof(checklist)='array' and jsonb_typeof(reminders)='array'),
 check(trigger not in ('once','weekly') or scheduled_at is not null),
 check(trigger not in ('confirmed','unit_completed','before_class','after_class') or subject is not null or course_id is not null)
);
create table public.task_instances (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), title text not null check(length(title)>0),
 subject text, course_id uuid, occurrence_id uuid, template_id uuid, source_key text not null,
 status text not null default 'pending' check(status in ('pending','active','completed','cancelled')),
 mode text not null default 'checklist' check(mode in ('checklist','reading','audio')), items jsonb not null default '[]', lesson jsonb,
 due_at timestamptz, due_kind text not null default 'fixed', due_occurrence_id uuid,
 estimated_minutes int not null default 20 check(estimated_minutes between 1 and 1440), material_kind text not null default 'general',
 template_snapshot jsonb not null default '{}', created_at timestamptz not null default now(), unique(user_id,id), unique(user_id,source_key),
 foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade,
 foreign key(user_id,occurrence_id) references public.task_course_occurrences(user_id,id) on delete cascade,
 foreign key(user_id,due_occurrence_id) references public.task_course_occurrences(user_id,id),
 foreign key(user_id,template_id) references public.task_templates(user_id,id), check(jsonb_typeof(items)='array')
);
create index task_instances_open on public.task_instances(user_id,due_at) where status in ('pending','active');
create table public.task_availability_windows (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 weekday int not null check(weekday between 0 and 6), on_date date, start_time time not null, end_time time not null, unavailable boolean not null default false, check(end_time>start_time), check(not unavailable or on_date is not null)
);
create table public.task_time_blocks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), task_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at>starts_at),
 check((starts_at at time zone 'Asia/Shanghai')::date=(ends_at at time zone 'Asia/Shanghai')::date),
 foreign key(user_id,task_id) references public.task_instances(user_id,id) on delete cascade
);
create index task_blocks_user_time on public.task_time_blocks(user_id,starts_at,ends_at);
create table public.task_materials (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null,
 lesson_key text not null, kind text not null, title text not null, href text, audio jsonb not null default '[]',
 unique(user_id,course_id,lesson_key,kind), foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade
);
create table public.task_lesson_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null, lesson jsonb not null,
 foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade
);
create unique index task_progress_lesson on public.task_lesson_progress(user_id,course_id,(lesson->>'key'));
create table public.task_unit_scopes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null,
 book text not null, unit text not null, lessons jsonb not null, emitted boolean not null default false,
 unique(user_id,course_id,book,unit), foreign key(user_id,course_id) references public.task_courses(user_id,id) on delete cascade,
 check(jsonb_typeof(lessons)='array' and jsonb_array_length(lessons)>0)
);
create table public.task_reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), task_id uuid, occurrence_id uuid,
 source_key text not null, title text not null, remind_at timestamptz not null, expires_at timestamptz,
 status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed')),
 attempts int not null default 0, lease_until timestamptz, read_at timestamptz, unique(user_id,source_key),
 foreign key(user_id,task_id) references public.task_instances(user_id,id) on delete cascade,
 foreign key(user_id,occurrence_id) references public.task_course_occurrences(user_id,id) on delete cascade
);
create index task_reminders_dispatch on public.task_reminders(status,remind_at);
create table public.task_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now()
);
-- Delivery ledger prevents resending to successful devices when another device fails.
create table public.task_push_deliveries (
 reminder_id uuid not null references public.task_reminders(id) on delete cascade,
 subscription_id uuid not null references public.task_push_subscriptions(id) on delete cascade,
 primary key(reminder_id,subscription_id)
);
alter table public.task_push_deliveries enable row level security;
revoke all on public.task_push_deliveries from anon,authenticated;
grant all on public.task_push_deliveries to service_role;

do $$ declare t text; begin
 foreach t in array array['task_courses','task_timetable_rules','task_course_exceptions','task_course_occurrences','task_templates','task_instances','task_availability_windows','task_time_blocks','task_materials','task_lesson_progress','task_unit_scopes','task_reminders','task_push_subscriptions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create index on public.%I(user_id)',t);
 end loop;
end $$;

create function public.task_assert_owner(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_user is null or (p_user is distinct from auth.uid() and coalesce(auth.jwt()->>'role','')<>'service_role') then raise exception 'unauthorized'; end if;
end $$;

-- All mutable operations take the same per-user transaction lock.
create function public.task_user_lock(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin perform public.task_assert_owner(p_user); perform pg_advisory_xact_lock(hashtextextended(p_user::text,228)); end $$;

create function public.task_emit(p_user uuid,p_template uuid,p_source text,p_occurrence uuid default null,p_lesson jsonb default null,p_items jsonb default null,p_anchor timestamptz default now(),p_course uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.task_templates; c public.task_course_occurrences; n public.task_course_occurrences; due timestamptz; task_id uuid; its jsonb; title text;
begin
 perform public.task_user_lock(p_user);
 select * into t from public.task_templates where id=p_template and user_id=p_user and enabled;
 if not found then return; end if;
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
 values(p_user,title,coalesce(t.subject,(select subject from public.task_courses where id=coalesce(c.course_id,p_course,t.course_id) and user_id=p_user)),coalesce(c.course_id,p_course,t.course_id),p_occurrence,t.id,p_source,t.mode,its,p_lesson,due,t.deadline->>'kind',case when t.deadline->>'kind'='next_class' then n.id end,t.estimated_minutes,t.material_kind,to_jsonb(t))
 on conflict(user_id,source_key) do nothing returning id into task_id;
end $$;

create function public.task_check_units(p_user uuid,p_course uuid) returns void language plpgsql security invoker set search_path='' as $$
declare s public.task_unit_scopes; t public.task_templates; sub text;
begin
 perform public.task_user_lock(p_user);
 select subject into sub from public.task_courses where id=p_course and user_id=p_user;
 for s in select * from public.task_unit_scopes where user_id=p_user and course_id=p_course and not emitted loop
 if not exists(select 1 from jsonb_array_elements(s.lessons) l where not exists(select 1 from public.task_lesson_progress p where p.user_id=p_user and p.course_id=p_course and p.lesson->>'key'=l->>'key')) then
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger='unit_completed' and (course_id=p_course or (course_id is null and subject=sub)) loop
 perform public.task_emit(p_user,t.id,'unit:'||p_course||':'||s.book||':'||s.unit||':'||t.id,null,jsonb_build_object('key',s.book||':unit:'||s.unit,'title','第 '||s.unit||' 单元','book',s.book,'unit',s.unit,'kind','unit'),null,now(),p_course);
 end loop;
 update public.task_unit_scopes set emitted=true where id=s.id;
 end if;
 end loop;
end $$;

create function public.task_confirm_course(p_occurrence uuid,p_confirmation jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); c public.task_course_occurrences; t public.task_templates; sub text; lesson jsonb; its jsonb;
begin
 perform public.task_user_lock(u);
 select * into strict c from public.task_course_occurrences where id=p_occurrence and user_id=u for update;
 if c.status='confirmed' then return; end if;
 if c.status='cancelled' or c.ends_at>now() then raise exception 'course_not_finished'; end if;
 lesson:=p_confirmation->'lesson';
 if coalesce(lesson->>'key','')='' or coalesce(lesson->>'title','')='' then raise exception 'lesson_required'; end if;
 select subject into sub from public.task_courses where user_id=u and id=c.course_id;
 if sub='chinese' and jsonb_array_length(coalesce(p_confirmation->'unit_lessons','[]'))>0 then
 insert into public.task_unit_scopes(user_id,course_id,book,unit,lessons) values(u,c.course_id,lesson->>'book',lesson->>'unit',p_confirmation->'unit_lessons') on conflict(user_id,course_id,book,unit) do nothing;
 end if;
 update public.task_course_occurrences set status='confirmed',confirmation=p_confirmation where id=c.id;
 insert into public.task_lesson_progress(user_id,course_id,lesson) values(u,c.course_id,lesson) on conflict do nothing;
 for t in select * from public.task_templates where user_id=u and enabled and trigger='confirmed' and (course_id=c.course_id or (course_id is null and subject=sub)) and (lesson_filter is null or lesson_filter=(lesson->>'lesson')::int) loop
 its:=case t.item_source when 'class' then p_confirmation->'class_items' when 'homework' then p_confirmation->'homework_items' else null end;
 if t.item_source<>'template' and jsonb_array_length(coalesce(its,'[]'))=0 then continue; end if;
 perform public.task_emit(u,t.id,'class:'||c.id||':'||t.id,c.id,case when t.target='next' then nullif(p_confirmation->'next_lesson','null'::jsonb) else lesson end,its,now());
 end loop;
 perform public.task_check_units(u,c.course_id);
end $$;

create function public.task_update_preview(p_occurrence uuid,p_lesson jsonb) returns int language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); unchanged int;
begin
 perform public.task_user_lock(u);
 if not exists(select 1 from public.task_course_occurrences where id=p_occurrence and user_id=u and status='confirmed') then raise exception 'confirmed_course_required'; end if;
 if coalesce(p_lesson->>'key','')='' then raise exception 'lesson_required'; end if;
 update public.task_course_occurrences set confirmation=jsonb_set(confirmation,'{next_lesson}',p_lesson) where id=p_occurrence and user_id=u;
 update public.task_instances i set lesson=p_lesson,title=(i.template_snapshot->>'name')||' · '||(p_lesson->>'title')
 where i.user_id=u and i.occurrence_id=p_occurrence and i.template_snapshot->>'target'='next' and i.status='pending'
 and not exists(select 1 from jsonb_array_elements(i.items) x where (x->>'done')::boolean);
 select count(*) into unchanged from public.task_instances i where i.user_id=u and i.occurrence_id=p_occurrence and i.template_snapshot->>'target'='next' and (i.status<>'pending' or exists(select 1 from jsonb_array_elements(i.items) x where (x->>'done')::boolean));
 return unchanged;
end $$;

create function public.task_backfill(p_course uuid,p_lessons jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); l jsonb;
begin
 perform public.task_user_lock(u);
 for l in select * from jsonb_array_elements(p_lessons) loop
 insert into public.task_lesson_progress(user_id,course_id,lesson) values(u,p_course,l) on conflict do nothing;
 end loop;
 perform public.task_check_units(u,p_course);
end $$;

-- Enforce planning constraints in the database as well as the UI.
create function public.task_validate_block() returns trigger language plpgsql security invoker set search_path='' as $$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date;
begin
 perform public.task_user_lock(new.user_id);
 if not exists(select 1 from public.task_instances where id=new.task_id and user_id=new.user_id and status in ('pending','active')) then raise exception 'task_not_open'; end if;
 if new.starts_at<now() then raise exception 'time_in_past'; end if;
 if not coalesce((select range_agg(tstzrange((d+w.start_time) at time zone 'Asia/Shanghai',(d+w.end_time) at time zone 'Asia/Shanghai','[)')) @> tstzrange(new.starts_at,new.ends_at,'[)') from public.task_availability_windows w where w.user_id=new.user_id and not w.unavailable
 and (w.on_date=d or (w.on_date is null and w.weekday=extract(dow from d) and not exists(select 1 from public.task_availability_windows a where a.user_id=new.user_id and a.on_date=d)))
 ),false) then raise exception 'outside_available_window'; end if;
 if exists(select 1 from public.task_course_occurrences c where c.user_id=new.user_id and c.status<>'cancelled' and c.starts_at<new.ends_at and c.ends_at>new.starts_at)
 or exists(select 1 from public.task_time_blocks b join public.task_instances i on i.id=b.task_id and i.user_id=b.user_id where i.status in ('pending','active') and b.user_id=new.user_id and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'time_conflict'; end if;
 return new;
end $$;
create trigger task_block_guard before insert or update on public.task_time_blocks for each row execute function public.task_validate_block();

-- Reconcile generated instances and reminders; also callable from the authenticated page.
create function public.task_tick(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare r public.task_timetable_rules; o public.task_course_occurrences; t public.task_templates; i public.task_instances; rr jsonb; d date; sub text; fire timestamptz; anchor timestamptz; due public.task_course_occurrences; rec record;
begin
 perform public.task_user_lock(p_user);
 for r in select * from public.task_timetable_rules where user_id=p_user loop
 for d in select g::date from generate_series(greatest(r.valid_from,(now() at time zone 'Asia/Shanghai')::date-35),least(coalesce(r.valid_until,'infinity'::date),(now() at time zone 'Asia/Shanghai')::date+35),interval '1 day') g where extract(dow from g)=r.weekday loop
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at)
 values(p_user,r.course_id,r.id,d,(d+r.start_time) at time zone 'Asia/Shanghai',(d+r.end_time) at time zone 'Asia/Shanghai')
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 end loop;
 -- Preserve confirmed occurrences and reconcile rule/exception changes per original date.
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'confirmed' loop
 select * into r from public.task_timetable_rules where id=o.rule_id;
 select * into rec from public.task_course_exceptions where user_id=p_user and rule_id=o.rule_id and original_date=o.original_date;
 update public.task_course_occurrences set starts_at=coalesce(rec.starts_at,(o.original_date+r.start_time) at time zone 'Asia/Shanghai'),ends_at=coalesce(rec.ends_at,(o.original_date+r.end_time) at time zone 'Asia/Shanghai'),status=case when coalesce(rec.cancelled,false) or o.original_date<r.valid_from or o.original_date>coalesce(r.valid_until,'infinity'::date) then 'cancelled' else 'scheduled' end where id=o.id;
 end loop;
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'cancelled' loop
 select subject into sub from public.task_courses where id=o.course_id;
 if o.status='scheduled' and o.ends_at<=now() then
 insert into public.task_reminders(user_id,occurrence_id,source_key,title,remind_at,expires_at)
 values(p_user,o.id,'confirm:'||o.id,'请确认课程：'||(select name from public.task_courses where id=o.course_id),o.ends_at,o.ends_at+interval '1 day') on conflict(user_id,source_key) do nothing;
 end if;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('before_class','after_class') and (course_id=o.course_id or (course_id is null and subject=sub)) loop
 fire:=case t.trigger when 'before_class' then o.starts_at-make_interval(mins=>t.trigger_minutes) else o.ends_at end;
 if fire<=now() and ((t.trigger='before_class' and o.starts_at>now() and t.created_at<o.starts_at) or (t.trigger='after_class' and t.created_at<=o.ends_at)) then perform public.task_emit(p_user,t.id,'class:'||o.id||':'||t.id,o.id,null,null,fire); end if;
 end loop;
 end loop;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('weekly','once') loop
 if t.trigger='once' and t.scheduled_at<=now() then perform public.task_emit(p_user,t.id,'once:'||t.id,null,null,null,t.scheduled_at);
 elsif t.trigger='weekly' then
 for d in select g::date from generate_series(greatest((t.scheduled_at at time zone 'Asia/Shanghai')::date,(t.created_at at time zone 'Asia/Shanghai')::date,coalesce((t.generated_through at time zone 'Asia/Shanghai')::date,'-infinity'::date)),(now() at time zone 'Asia/Shanghai')::date,interval '1 day') g where extract(dow from g)::int=any(t.weekdays) loop
 fire:=(d+(t.scheduled_at at time zone 'Asia/Shanghai')::time) at time zone 'Asia/Shanghai';
 if fire<=now() then perform public.task_emit(p_user,t.id,'weekly:'||t.id||':'||d,null,null,null,fire); end if;
 end loop;
 end if;
 update public.task_templates set generated_through=now() where id=t.id;
 end loop;
 -- Relative next-class deadlines follow the actual current timetable, fixed deadlines do not.
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and due_kind='next_class' and course_id is not null loop
 select * into o from public.task_course_occurrences where id=i.occurrence_id;
 select * into t from jsonb_populate_record(null::public.task_templates,i.template_snapshot);
 select * into due from public.task_course_occurrences where user_id=p_user and course_id=i.course_id and status<>'cancelled'
 and (case when i.occurrence_id is null then starts_at>i.created_at when t.trigger='before_class' then starts_at>=o.starts_at else starts_at>o.starts_at end) order by starts_at limit 1;
 update public.task_instances set due_at=due.starts_at,due_occurrence_id=due.id where id=i.id;
 end loop;
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
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=now())
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $$;

-- Atomic course-rule replacement preserves the original rule's identity for historical rows.
create function public.task_replace_rule(p_rule uuid,p_from date,p_weekday int,p_start time,p_end time,p_until date default null) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); r public.task_timetable_rules;
begin
 perform public.task_user_lock(u);
 select * into strict r from public.task_timetable_rules where user_id=u and id=p_rule for update;
 if p_from<(now() at time zone 'Asia/Shanghai')::date or p_from<r.valid_from then raise exception 'invalid_effective_date'; end if;
 update public.task_timetable_rules set valid_until=p_from-1 where id=r.id;
 insert into public.task_timetable_rules(user_id,course_id,weekday,start_time,end_time,valid_from,valid_until) values(u,r.course_id,p_weekday,p_start,p_end,p_from,p_until);
 perform public.task_tick(u);
end $$;

create function public.task_claim_reminders() returns setof public.task_reminders language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'unauthorized'; end if;
 return query with picked as (
 select id from public.task_reminders where remind_at<=now() and (expires_at is null or expires_at>now()) and attempts<4
 and (status='pending' or (status='sending' and lease_until<now())) order by remind_at for update skip locked limit 10
 ) update public.task_reminders r set status='sending',attempts=attempts+1,lease_until=now()+interval '3 minutes' from picked where r.id=picked.id returning r.*;
end $$;

-- Private audio: signed URLs, per-user storage prefixes, no public media access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('task-audio','task-audio',false,52428800,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/aac','audio/flac']) on conflict(id) do nothing;
create policy task_audio_owner on storage.objects for all to authenticated
using(bucket_id='task-audio' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='task-audio' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Default EXECUTE on functions is PUBLIC; explicitly limit every entry point.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('task_assert_owner','task_user_lock','task_emit','task_check_units','task_confirm_course','task_update_preview','task_backfill','task_validate_block','task_tick','task_replace_rule','task_claim_reminders') loop
 execute format('revoke all on function %s from public,anon',f.sig);
 execute format('grant execute on function %s to authenticated,service_role',f.sig);
 end loop;
end $$;
revoke execute on function public.task_claim_reminders() from authenticated;

create function public.task_initialize(p_templates jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); t jsonb;
begin
 perform public.task_user_lock(u);
 if not exists(select 1 from public.task_courses where user_id=u) then
 insert into public.task_courses(user_id,name,subject) values(u,'语文','chinese'),(u,'纳约数学','math'),(u,'厚海英语','english'),(u,'舞蹈','dance'),(u,'钢琴','piano'),(u,'游泳','swimming');
 end if;
 if not exists(select 1 from public.task_templates where user_id=u) then
 for t in select * from jsonb_array_elements(p_templates) loop
 insert into public.task_templates(user_id,name,subject,course_id,enabled,mode,trigger,target,checklist,estimated_minutes,deadline,reminders,trigger_minutes,weekdays,scheduled_at,lesson_filter,material_kind,item_source)
 select u,t->>'name',t->>'subject',null,true,t->>'mode',t->>'trigger',t->>'target',t->'checklist',(t->>'estimated_minutes')::int,t->'deadline',t->'reminders',(t->>'trigger_minutes')::int,array(select jsonb_array_elements_text(t->'weekdays')::int),null,(t->>'lesson_filter')::int,t->>'material_kind',t->>'item_source';
 end loop;
 end if;
end $$;
revoke all on function public.task_initialize(jsonb) from public,anon;
grant execute on function public.task_initialize(jsonb) to authenticated;

-- Task state changes cancel queued reminders immediately, without waiting for cron.
create function public.task_state_reminders() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('completed','cancelled') then
 update public.task_reminders set status='cancelled',lease_until=null where user_id=new.user_id and task_id=new.id and status in ('pending','sending','failed');
 elsif new.due_at is distinct from old.due_at and old.due_at is not null and new.due_at is not null then
 update public.task_reminders set remind_at=remind_at+(new.due_at-old.due_at) where user_id=new.user_id and task_id=new.id and status='pending' and source_key like 'custom:%';
 end if;
 return new;
end $$;
create trigger task_state_reminder_update after update on public.task_instances for each row execute function public.task_state_reminders();
revoke all on function public.task_state_reminders() from public,anon;
grant execute on function public.task_state_reminders() to authenticated,service_role;
