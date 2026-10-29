-- Additive course-domain foundation. Apply only with the matching event-aware runtime.
-- Legacy occurrence/confirmation, template IDs and task completion data remain intact.
begin;

create table public.task_course_catalog_snapshots (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 version text not null check(length(version)>0), subject text not null,
 ordered_lessons jsonb not null default '[]' check(jsonb_typeof(ordered_lessons)='array'),
 teaching_segments jsonb not null default '[]' check(jsonb_typeof(teaching_segments)='array'),
 created_at timestamptz not null default now(), unique(user_id,id), unique(user_id,subject,version)
);

alter table public.task_courses
 add column course_type text not null default 'timetabled' check(course_type in ('timetabled','flexible')),
 add column auto_assign boolean not null default false,
 add column auto_advance boolean not null default false,
 add column catalog_snapshot_id uuid,
 add column cursor jsonb check(cursor is null or coalesce(jsonb_typeof(cursor)='object' and nullif(cursor->>'lesson_key','') is not null and jsonb_typeof(cursor->'segment_key') in ('null','string'),false)),
 add column rules_revision integer not null default 1 check(rules_revision>0),
 add column effective_from date,
 add column automation_enabled_at timestamptz,
 add foreign key(user_id,catalog_snapshot_id) references public.task_course_catalog_snapshots(user_id,id);
-- Deliberately do not infer an automation cursor or enable automation from old progress.

-- Rule kind describes that rule over its own validity period. It is intentionally
-- not tied to current course_type: retired timed history survives type conversion.
-- Atomic course-save validates newly active kinds against its requested course type.
alter table public.task_timetable_rules
 alter column start_time drop not null, alter column end_time drop not null,
 add column kind text not null default 'timetabled' check(kind in ('timetabled','flexible')),
 add constraint task_rule_clock_contract check(
   (kind='timetabled' and start_time is not null and end_time is not null and end_time>start_time)
   or (kind='flexible' and start_time is null and end_time is null)
 );

alter table public.task_templates
 add column activity_key text,
 add column scope jsonb not null default '{"kind":"all"}' check(coalesce(jsonb_typeof(scope)='object' and scope->>'kind' in ('all','lessons','segments','unit'),false)),
 add column progress_mode text not null default 'percentage' check(progress_mode in ('percentage','items')),
 add column material_selector jsonb not null default '{"kind":"auto"}' check(coalesce(jsonb_typeof(material_selector)='object' and material_selector->>'kind' in ('auto','none','assets'),false));
update public.task_templates set activity_key='legacy:'||id::text,
 progress_mode=case when mode='checklist' then 'items' else 'percentage' end;
alter table public.task_templates alter column activity_key set not null;
-- Keep old writers source-compatible: omitted activity keys get a unique identity.
alter table public.task_templates alter column activity_key set default ('custom:'||gen_random_uuid()::text);
alter table public.task_templates add check(length(activity_key)>0);

create table public.task_course_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null,
 rule_id uuid, occurrence_id uuid, event_key text not null check(length(event_key)>0), on_date date not null,
 starts_at timestamptz, ends_at timestamptz, release_at timestamptz not null,
 lesson_snapshot jsonb check(lesson_snapshot is null or jsonb_typeof(lesson_snapshot)='object'),
 revision integer not null default 1 check(revision>0),
 assignment_state text not null default 'pending' check(assignment_state in ('pending','assigned','skipped','cancelled')),
 completed_at timestamptz, legacy_confirmation jsonb,
 unique(user_id,id), unique(user_id,event_key), unique(user_id,occurrence_id),
 foreign key(user_id,course_id) references public.task_courses(user_id,id),
 foreign key(user_id,rule_id) references public.task_timetable_rules(user_id,id),
 foreign key(user_id,occurrence_id) references public.task_course_occurrences(user_id,id),
 check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at>starts_at)),
 check((starts_at is null and release_at=on_date::timestamp at time zone 'Asia/Shanghai') or (starts_at is not null and release_at=ends_at))
);
create index task_course_events_release on public.task_course_events(user_id,release_at);

create table public.task_course_pool_bindings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), course_id uuid not null, pool_item_id uuid not null,
 enabled boolean not null default true, scope_override jsonb, estimated_minutes_override integer check(estimated_minutes_override between 1 and 1440),
 material_override jsonb, unique(user_id,id), unique(user_id,course_id,pool_item_id),
 foreign key(user_id,course_id) references public.task_courses(user_id,id),
 foreign key(user_id,pool_item_id) references public.task_templates(user_id,id),
 check(scope_override is null or coalesce(jsonb_typeof(scope_override)='object' and scope_override->>'kind' in ('all','lessons','segments','unit'),false)),
 check(material_override is null or coalesce(jsonb_typeof(material_override)='object' and material_override->>'kind' in ('auto','none','assets'),false))
);
-- Match the legacy trigger applicability. Weekly/once tasks remain personal and unbound.
insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id,enabled)
 select c.user_id,c.id,t.id,t.enabled from public.task_courses c join public.task_templates t on t.user_id=c.user_id
 and (t.course_id=c.id or (t.course_id is null and t.subject=c.subject))
 where t.trigger in ('before_class','after_class','confirmed','unit_completed');

-- Existing confirmations are readable in both representations. No original rows are changed.
-- Legacy rows have no confirmed_at; ends_at is retained as their historical completion anchor.
insert into public.task_course_events(id,user_id,course_id,rule_id,occurrence_id,event_key,on_date,starts_at,ends_at,release_at,lesson_snapshot,assignment_state,completed_at,legacy_confirmation)
 select o.id,o.user_id,o.course_id,o.rule_id,o.id,'timetabled:'||o.rule_id::text||':'||o.original_date::text,o.original_date,o.starts_at,o.ends_at,o.ends_at,
 case when o.confirmation is null then null else jsonb_build_object('lesson',o.confirmation->'lesson','cursor',
 case when nullif(o.confirmation->'lesson'->>'key','') is null then null else jsonb_build_object('lesson_key',o.confirmation->'lesson'->>'key','segment_key',null) end,'catalog_version',null) end,
 case when o.status='cancelled' then 'cancelled' when o.status='confirmed' then 'assigned' else 'pending' end,
 case when o.status='confirmed' then o.ends_at end,o.confirmation from public.task_course_occurrences o;

alter table public.task_instances
 add column course_event_id uuid,
 add column event_key text,
 add column revision integer not null default 1 check(revision>0),
 add column progress_mode text not null default 'percentage' check(progress_mode in ('percentage','items')),
 add column completion_percent numeric not null default 0 check(completion_percent between 0 and 100),
 add column release_at timestamptz,
 add column recovery_due_at timestamptz,
 add foreign key(user_id,course_event_id) references public.task_course_events(user_id,id);
update public.task_instances i set course_event_id=e.id,event_key=e.event_key from public.task_course_events e where e.user_id=i.user_id and e.occurrence_id=i.occurrence_id;
update public.task_instances set progress_mode=case when mode='checklist' then 'items' else 'percentage' end,
 completion_percent=case when status='completed' then 100 else 0 end;

create table public.task_instance_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), task_id uuid not null,
 item_key text not null check(length(item_key)>0), label text not null, done boolean not null default false,
 cancelled boolean not null default false, href text, sort_order integer not null default 0, revision integer not null default 1 check(revision>0),
 unique(user_id,id), unique(user_id,task_id,item_key),
 foreign key(user_id,task_id) references public.task_instances(user_id,id) on delete cascade
);
insert into public.task_instance_items(user_id,task_id,item_key,label,done,href,sort_order)
 select t.user_id,t.id,coalesce(nullif(v->>'id',''),'legacy:'||ord::text),coalesce(v->>'label',''),coalesce((v->>'done')::boolean,false),v->>'href',ord::integer
 from public.task_instances t cross join lateral jsonb_array_elements(t.items) with ordinality x(v,ord)
 on conflict(user_id,task_id,item_key) do nothing;

-- Audit/control data is not writable by the browser; later atomic progress RPCs append it.
create table public.task_progress_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), task_id uuid not null,
 revision integer not null check(revision>0), kind text not null, payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), unique(user_id,id), unique(user_id,task_id,revision),
 foreign key(user_id,task_id) references public.task_instances(user_id,id)
);

do $$ declare t text; begin
 foreach t in array array['task_course_catalog_snapshots','task_course_events','task_course_pool_bindings','task_instance_items'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   execute format('grant select,insert,update,delete on public.%I to authenticated',t);
   execute format('grant all on public.%I to service_role',t);
   execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
   execute format('create index on public.%I(user_id)',t);
 end loop;
end $$;
alter table public.task_progress_events enable row level security;
revoke all on public.task_progress_events from public,anon,authenticated;
grant all on public.task_progress_events to service_role;
create index on public.task_progress_events(user_id);

-- This stage introduces no functions or EXECUTE grants. Existing RPC signatures are unchanged.
commit;
