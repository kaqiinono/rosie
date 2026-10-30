-- Forward-only Task7 review repairs: independent activities, exact revised selectors.
-- Keep the canonical emitters and source identities; do not introduce another generator.
begin;

create or replace function private.task_resolve_materials(
  p_user uuid, p_course uuid, p_scope jsonb, p_selector jsonb, p_content jsonb
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  ids jsonb;
begin
  -- Private workers may have no browser JWT. Their caller already owns the user/template.
  -- The public task_emit/task_tick boundaries authenticate p_user; browser cannot call here.
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'user_required' using errcode = '42501';
  end if;
  if p_course is not null and not exists (
    select 1 from public.task_courses where id = p_course and user_id = p_user
  ) then
    raise exception 'course_not_owned' using errcode = '42501';
  end if;
  if p_selector->>'kind' = 'none' then
    return '{"status":"not_required","asset_ids":[]}';
  end if;

  select coalesce(jsonb_agg(a.id order by a.id), '[]') into ids
  from public.material_assets a
  where a.status = 'ready' and case p_selector->>'kind'
    when 'assets' then coalesce(p_selector->'asset_ids', '[]') ? a.id::text
    when 'auto' then p_course is not null and exists (
      select 1 from public.course_material_links l
      where l.user_id = p_user and l.course_id = p_course and l.asset_id = a.id
        and private.material_scope_matches(l.scope, p_content)
    )
    else false
  end;

  return jsonb_build_object(
    'status', case when jsonb_array_length(ids) > 0 then 'selected' else 'pending' end,
    'asset_ids', ids
  );
end;
$$;

create or replace function private.material_snapshot_selector() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Generators write their exact effective policy explicitly. This is only the
  -- insertion fallback for legacy/manual callers, never a live-binding rebase on progress.
  if TG_OP = 'INSERT' and new.material_selector_snapshot is null then
    new.material_selector_snapshot := coalesce(
      (select b.material_override from public.task_course_pool_bindings b
       where b.user_id = new.user_id and b.course_id = new.course_id
         and b.pool_item_id = new.template_id),
      new.template_snapshot->'material_selector', '{"kind":"auto"}'::jsonb
    );
  end if;
  return new;
end;
$$;

-- Independent weekly/once generation keeps its existing deadline/source handling.
create or replace function private.task_emit_independent(
  p_user uuid, p_template uuid, p_source text, p_occurrence uuid default null,
  p_lesson jsonb default null, p_items jsonb default null,
  p_anchor timestamptz default now(), p_course uuid default null
) returns void
language plpgsql security invoker set search_path='' as $$
declare
  t public.task_templates;
  c public.task_course_occurrences;
  n public.task_course_occurrences;
  due timestamptz;
  task_id uuid;
  its jsonb;
  title text;
  material jsonb;
  resolved_course uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
  select * into t from public.task_templates where id=p_template and user_id=p_user and enabled;
  if not found or t.trigger not in ('weekly','once') then
    return;
  end if;
  if t.target='next' and p_lesson is null then
    return;
  end if;
  if p_occurrence is not null then
    select * into strict c from public.task_course_occurrences where id=p_occurrence and user_id=p_user;
  end if;
  if p_occurrence is not null then
    select * into n from public.task_course_occurrences where user_id=p_user and course_id=c.course_id and status<>'cancelled'
    and (case when t.trigger='before_class' then
    starts_at>=c.starts_at else starts_at>c.starts_at end) order by starts_at limit 1;
  end if;
  if p_occurrence is null and coalesce(p_course,t.course_id) is not null then
    select * into n from public.task_course_occurrences where user_id=p_user and course_id=coalesce(p_course,t.course_id) and status<>'cancelled' and starts_at>p_anchor order by starts_at limit 1;
  end if;
  due := case t.deadline->>'kind'
  when 'same_day' then
  (((p_anchor at time zone 'Asia/Shanghai')::date)::text||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
  when 'days_after' then
  ((((p_anchor at time zone 'Asia/Shanghai')::date+coalesce((t.deadline->>'days')::int,1))::text)||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
  when 'fixed' then
  (t.deadline->>'at')::timestamptz
  when 'next_class' then
  n.starts_at end;
  its:=p_items;
  if its is null then
    select coalesce(jsonb_agg(jsonb_build_object('id',ord::text,'label',v,'done',false) order by ord),'[]') into its from jsonb_array_elements_text(t.checklist) with ordinality x(v,ord);
  end if;
  if t.target='unit' and p_lesson is not null then
    p_lesson:=jsonb_build_object('key',(p_lesson->>'book')||':unit:'||(p_lesson->>'unit'),'title','第 '||(p_lesson->>'unit')||' 单元','book',p_lesson->>'book','unit',p_lesson->>'unit','kind','unit');
  end if;
  title:=t.name||case when p_lesson is not null then
  ' · '||coalesce(p_lesson->>'title','') else '' end;
  resolved_course := coalesce(c.course_id,p_course,t.course_id);
  material := private.task_resolve_materials(
  p_user,resolved_course,t.scope,t.material_selector,jsonb_build_object('lesson',p_lesson)
  );
  insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,due_occurrence_id,estimated_minutes,material_kind,template_snapshot,material_status,material_assets,material_selector_snapshot)
  values(p_user,title,coalesce(t.subject,'other'),coalesce(c.course_id,p_course,t.course_id),p_occurrence,t.id,p_source,t.mode,its,p_lesson,due,t.deadline->>'kind',case when t.deadline->>'kind'='next_class' then
  n.id end,t.estimated_minutes,t.material_kind,to_jsonb(t),material->>'status',material->'asset_ids',t.material_selector)
  on conflict(user_id,source_key) do nothing returning id into task_id;
end $$;

-- Intentional event revision stores the selector that produced its material result.
create or replace function private.task_emit_event(
  p_user uuid, p_event uuid, p_phase text, p_now timestamptz,
  p_revise boolean default false
) returns void
language plpgsql set search_path='' as $$
declare
  e public.task_course_events;
  c public.task_courses;
  matches jsonb;
  m jsonb;
  t jsonb;
  target jsonb;
  material jsonb;
  deadline jsonb;
  next_event jsonb;
  completed_unit jsonb;
  item public.task_instances;
  new_items jsonb;
  changed boolean;
  keys text[]:='{}';
  key text;
  label text;
  taskid uuid;
  selection text;
  old_item jsonb;
  phase_release timestamptz;
  raw_release timestamptz;
  window_issue jsonb;
begin
  select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
  select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
  if e.assignment_state='cancelled' or c.archived_at is not null then
    return;
  end if;
  if e.lesson_snapshot->'lesson'->>'key' is not null and (e.progression_result->>'kind'='finished' or (e.next_snapshot->'lesson'->>'key' is not null and (e.next_snapshot->'lesson'->>'book' is distinct from e.lesson_snapshot->'lesson'->>'book' or e.next_snapshot->'lesson'->>'unit' is distinct from e.lesson_snapshot->'lesson'->>'unit'))) then
    completed_unit:=jsonb_build_object('book',e.lesson_snapshot->'lesson'->>'book','unit',e.lesson_snapshot->'lesson'->>'unit');
  end if;
  matches:=private.task_matches(to_jsonb(e),(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.task_course_pool_bindings b where b.user_id=p_user and b.course_id=c.id),(select coalesce(jsonb_agg(to_jsonb(tx)),'[]') from public.task_templates tx where tx.user_id=p_user),e.next_snapshot,completed_unit);
  next_event:=private.task_next_candidate(p_user,c.id,to_jsonb(e));
  for m in select v from jsonb_array_elements(matches) v loop
    t:=m->'template';
    if (p_phase='before_class') is distinct from (t->>'trigger'='before_class') then
      continue;
    end if;
    raw_release:=case when p_phase='before_class' then
    coalesce(e.starts_at,e.on_date::timestamp at time zone 'Asia/Shanghai')-make_interval(mins=>(t->>'trigger_minutes')::int) when p_phase='manual_after_class' then
    least(e.release_at,p_now) else e.release_at end;
    phase_release:=greatest(raw_release,coalesce(c.automation_enabled_at,raw_release));
    if not p_revise and phase_release>p_now then
      continue;
    end if;
    key:=m->>'source_key';
    keys:=array_append(keys,key);
    target:=m->'target_snapshot';
    material:=private.task_resolve_materials(p_user,c.id,m->'scope',m->'material_selector',target);
    deadline:=private.task_deadline(t->'deadline',c.default_deadline,to_jsonb(e),next_event,p_phase);
    if not p_revise and p_phase='before_class' and raw_release<c.automation_enabled_at and (deadline->>'due_at')::timestamptz<=c.automation_enabled_at then
      continue;
    end if;
    if raw_release>(deadline->>'due_at')::timestamptz then
      window_issue:=jsonb_build_object('code','release_after_deadline','source_key',key);
      update public.task_course_events set runtime_issues=runtime_issues||jsonb_build_array(window_issue) where id=e.id and not runtime_issues @> jsonb_build_array(window_issue);
    end if;
    selection:=case when c.subject='math' and t->>'mode'='checklist' and t->>'item_source'<>'class' then
    'pending' else 'ready' end;
    new_items:='[]';
    if c.subject='math' and t->>'item_source'='class' then
      select coalesce(jsonb_agg(jsonb_build_object('id',v,'label',v,'done',false)),'[]') into new_items from jsonb_array_elements_text(coalesce(target->'problem_keys','[]')) v;
      if new_items='[]' then
        selection:='pending';
      end if;
    elsif selection='ready' and t->>'progress_mode'='items' then
      select coalesce(jsonb_agg(jsonb_build_object('id','check:'||private.task_uri(coalesce(target->'lesson'->>'key',''))||':'||ord,'label',v,'done',false) order by ord),'[]') into new_items from jsonb_array_elements_text(t->'checklist') with ordinality x(v,ord);
    end if;
    select * into item from public.task_instances where user_id=p_user and source_key=key;
    if found then
      if not p_revise or item.status='completed' then
        continue;
      end if;
      changed:=coalesce(item.content_snapshot->'lesson'->>'key','') is distinct from coalesce(target->'lesson'->>'key','') or item.content_snapshot->'cursor' is distinct from target->'cursor' or item.content_snapshot->'problem_keys' is distinct from target->'problem_keys';
      insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(p_user,item.id,item.revision,'content_revision',jsonb_build_object('task',to_jsonb(item))) on conflict do nothing;
      select coalesce(jsonb_agg(v||jsonb_build_object('done',coalesce((select done from public.task_instance_items x where x.user_id=p_user and x.task_id=item.id and x.item_key=v->>'id'),false))),'[]') into new_items from jsonb_array_elements(new_items) v;
      update public.task_instances set title=(t->>'name')||case when target->'lesson'->>'title' is not null then
      ' · '||(target->'lesson'->>'title') else '' end,
      lesson=target->'lesson',content_snapshot=target,items=new_items,revision=revision+1,
      completion_percent=case when changed and progress_mode='percentage' then
      0 else completion_percent end,
      status=case when status='cancelled' or (changed and progress_mode='percentage') then
      'pending' else status end,
      -- Content/schedule revision is not an explicit original-deadline edit.
      due_at=case when item.due_at<=p_now then
      item.due_at else (deadline->>'due_at')::timestamptz end,
      due_kind=case when item.due_at<=p_now then
      item.due_kind else deadline->>'kind' end,template_snapshot=t||jsonb_build_object('resolved_deadline',deadline->'policy'),selection_state=selection,material_status=material->>'status',material_assets=material->'asset_ids',
      material_selector_snapshot=m->'material_selector' where id=item.id;
      taskid:=item.id;
    else
      insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,estimated_minutes,material_kind,template_snapshot,course_event_id,event_key,progress_mode,release_at,selection_state,material_status,material_assets,content_snapshot,material_selector_snapshot)
      values(p_user,(t->>'name')||case when target->'lesson'->>'title' is not null then
      ' · '||(target->'lesson'->>'title') else '' end,c.subject,c.id,e.occurrence_id,(t->>'id')::uuid,key,t->>'mode',new_items,target->'lesson',(deadline->>'due_at')::timestamptz,deadline->>'kind',(m->>'estimated_minutes')::int,t->>'material_kind',t||jsonb_build_object('resolved_deadline',deadline->'policy'),e.id,e.event_key,t->>'progress_mode',phase_release,selection,material->>'status',material->'asset_ids',target,m->'material_selector')
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
  update public.task_course_events set runtime_issues=runtime_issues||case when e.next_snapshot is null and exists(select 1 from public.task_course_pool_bindings b join public.task_templates t on t.user_id=b.user_id and t.id=b.pool_item_id where b.user_id=p_user and b.course_id=c.id and b.enabled and t.enabled and t.target='next') then
  '[{"code":"missing_next_lesson"}]'::jsonb else '[]'::jsonb end where id=e.id and not runtime_issues @> '[{"code":"missing_next_lesson"}]';
end $$;


-- CREATE OR REPLACE retains the existing ACLs; restate browser exclusion explicitly.
revoke all on function private.task_resolve_materials(uuid,uuid,jsonb,jsonb,jsonb),
  private.material_snapshot_selector(),
  private.task_emit_independent(uuid,uuid,text,uuid,jsonb,jsonb,timestamptz,uuid),
  private.task_emit_event(uuid,uuid,text,timestamptz,boolean)
from public, anon, authenticated;

commit;
