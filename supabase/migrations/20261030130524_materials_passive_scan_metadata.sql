-- Passive metadata repair only: identity, content, links and progress are untouched.
create function public.material_scan_file_type(p_path text) returns jsonb language sql immutable set search_path='' as $$
 select case lower(substring(p_path from '[.]([^. /]+)$'))
 when 'mp3' then '{"kind":"audio","mime":"audio/mpeg"}'::jsonb
 when 'jpg' then '{"kind":"image","mime":"image/jpeg"}'::jsonb
 when 'jpeg' then '{"kind":"image","mime":"image/jpeg"}'::jsonb
 when 'png' then '{"kind":"image","mime":"image/png"}'::jsonb
 when 'gif' then '{"kind":"image","mime":"image/gif"}'::jsonb
 when 'webp' then '{"kind":"image","mime":"image/webp"}'::jsonb
 when 'avif' then '{"kind":"image","mime":"image/avif"}'::jsonb
 when 'm4a' then '{"kind":"audio","mime":"audio/mp4"}'::jsonb
 when 'wav' then '{"kind":"audio","mime":"audio/wav"}'::jsonb
 when 'ogg' then '{"kind":"audio","mime":"audio/ogg"}'::jsonb
 when 'mp4' then '{"kind":"video","mime":"video/mp4"}'::jsonb
 when 'webm' then '{"kind":"video","mime":"video/webm"}'::jsonb
 when 'ogv' then '{"kind":"video","mime":"video/ogg"}'::jsonb
 when 'pdf' then '{"kind":"pdf","mime":"application/pdf"}'::jsonb
 else '{"kind":"file","mime":"application/octet-stream"}'::jsonb end
$$;
revoke all on function public.material_scan_file_type(text) from public,anon,authenticated;
grant execute on function public.material_scan_file_type(text) to service_role;
create or replace function public.material_publish_scan(p_id uuid,p_user uuid,p_revision integer,p_account text,p_generation uuid,p_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.material_scan_sessions;f jsonb;a uuid;result jsonb:='[]';begin
 perform 1 from public.baidu_oauth_credentials where id='primary' and account_id=p_account and account_generation=p_generation for update;
 if not found then raise exception 'baidu_account_changed';end if;
 select * into strict s from public.material_scan_sessions where id=p_id and user_id=p_user for update;
 if s.account_id<>p_account or s.account_generation<>p_generation or s.revision<>p_revision then raise exception 'scan_stale';end if;
 for f in select value from jsonb_array_elements(p_state->'entries') loop
 if f->>'account_id'<>p_account or f->>'fs_id' !~ '^[1-9][0-9]{0,19}$' or not starts_with(f->>'path',s.path||'/') then raise exception 'invalid_scan_entry';end if;
 if not (f->>'isdir')::boolean then
 insert into public.material_assets(subject,kind,source,account_id,fs_id,path,title,mime_type,size,created_by)
 values(s.subject,public.material_scan_file_type(f->>'path')->>'kind','baidu',p_account,f->>'fs_id',f->>'path',left(f->>'name',240),public.material_scan_file_type(f->>'path')->>'mime',(f->>'size')::bigint,p_user)
 on conflict(account_id,fs_id,version) where source='baidu' do update set path=excluded.path,kind=case when material_assets.kind='file' and material_assets.mime_type='application/octet-stream' then excluded.kind else material_assets.kind end,mime_type=case when material_assets.kind='file' and material_assets.mime_type='application/octet-stream' then excluded.mime_type else material_assets.mime_type end,status=case when material_assets.status='archived' then 'archived' else 'ready' end
 returning id into a;
 f:=f||jsonb_build_object('asset_id',a);
 end if;
 result:=result||jsonb_build_array(f);
 end loop;
 update public.material_scan_sessions set state=p_state,revision=revision+1,updated_at=now() where id=p_id;
 return result;
end $$;
revoke all on function public.material_publish_scan(uuid,uuid,integer,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.material_publish_scan(uuid,uuid,integer,text,uuid,jsonb) to service_role;

-- Only previously scanned generic records; never reinterpret uploads/manual metadata.
update public.material_assets a set kind=public.material_scan_file_type(a.path)->>'kind',
 mime_type=public.material_scan_file_type(a.path)->>'mime'
where a.source='baidu' and a.kind='file' and a.mime_type='application/octet-stream'
 and public.material_scan_file_type(a.path)->>'kind'<>'file'
 and exists(select 1 from public.material_scan_sessions s cross join lateral jsonb_array_elements(s.state->'entries') f
 where s.account_id=a.account_id and f->>'fs_id'=a.fs_id and f->>'path'=a.path and not (f->>'isdir')::boolean);

-- Snapshot availability is separate from immutable selected IDs and archived metadata.
create or replace function public.task_planning_input(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'input_revision',coalesce((select revision from public.task_user_planning_revisions where user_id=p_user),0),'shared_revision',(select revision from private.task_planning_shared_epoch),'now',statement_timestamp(),'tight_ratio',coalesce((select tight_ratio from public.task_planning_settings where user_id=p_user),.2),'previous_allocations',coalesce((select result->'allow_weekend'->'allocations' from public.task_planning_snapshots where user_id=p_user),'[]'::jsonb))
 || jsonb_build_object('courses',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_courses x where user_id=p_user))
 || jsonb_build_object('rules',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_timetable_rules x where user_id=p_user))
 || jsonb_build_object('exceptions',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_exceptions x where user_id=p_user))
 || jsonb_build_object('occurrences',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_occurrences x where user_id=p_user))
 || jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_events x where user_id=p_user))
 || jsonb_build_object('catalog_snapshots',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_catalog_snapshots x where user_id=p_user))
 || jsonb_build_object('bindings',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_pool_bindings x where user_id=p_user))
 || jsonb_build_object('pool_items',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_templates x where user_id=p_user))
 || jsonb_build_object('tasks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_instances x where user_id=p_user))
 || jsonb_build_object('day_states',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_availability_day_states x where user_id=p_user))
 || jsonb_build_object('windows',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_availability_windows x where user_id=p_user))
 || jsonb_build_object('blocks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_time_blocks x where user_id=p_user))
 || jsonb_build_object('exams',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_exams x where user_id=p_user))
 || jsonb_build_object('material_links',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.course_material_links x where user_id=p_user))
 || jsonb_build_object('material_assets',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('current_available',x.status in ('ready','archived') and (x.source<>'baidu' or exists(select 1 from public.baidu_oauth_credentials c where c.id='primary' and c.account_id=x.account_id))) order by id),'[]') from public.material_assets x))
$$;
revoke all on function public.task_planning_input(uuid) from public,anon,authenticated;
grant execute on function public.task_planning_input(uuid) to service_role;

create trigger task_planning_account_dirty after insert or update or delete on public.baidu_oauth_credentials for each statement execute function private.task_planning_shared_dirty();
