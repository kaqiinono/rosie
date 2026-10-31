-- Shared assets, private links. File transport is deliberately server-owned (Tasks8/9).
create table public.material_assets(
 id uuid primary key default gen_random_uuid(),subject text not null check(subject in ('chinese','english','math','art','science','sports','dance','piano','swimming','other')),
 kind text not null check(kind in ('text','link','file','image','audio','video','pdf')),source text not null default 'manual' check(source in ('manual','builtin','baidu')),
 account_id text,fs_id text,path text,version integer not null default 1 check(version>0),title text not null check(length(trim(title)) between 1 and 240),
 mime_type text not null default 'text/plain',size bigint not null default 0 check(size>=0),created_by uuid not null references auth.users(id),
 status text not null default 'ready' check(status in ('ready','archived','pending','account_mismatch')),text_content text,href text,created_at timestamptz not null default now()
);
create unique index material_baidu_identity on public.material_assets(account_id,fs_id,version) where source='baidu';
create table public.course_material_links(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),course_id uuid not null,asset_id uuid not null references public.material_assets(id),
 scope jsonb not null default '{"kind":"all"}',role text not null default 'general' check(role in ('general','preview','review','dictation')),sort_order integer not null default 0,
 foreign key(user_id,course_id) references public.task_courses(user_id,id), unique(user_id,course_id,asset_id,scope,role)
);
create index on public.course_material_links(user_id,course_id);
alter table public.material_assets enable row level security;
alter table public.course_material_links enable row level security;
revoke all on public.material_assets,public.course_material_links from public,anon,authenticated;
grant select on public.material_assets,public.course_material_links to authenticated;
grant all on public.material_assets,public.course_material_links to service_role;
create policy shared_material_read on public.material_assets for select to authenticated using ((select auth.uid()) is not null);
create policy private_material_links on public.course_material_links for select to authenticated using(user_id=(select auth.uid()));

create function private.material_scope_matches(s jsonb,c jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case s->>'kind' when 'all' then true
 when 'unit' then s->>'book'=c->'lesson'->>'book' and s->>'unit'=c->'lesson'->>'unit'
 when 'lessons' then s->'lesson_keys' ? (c->'lesson'->>'key')
 when 'segments' then s->'segment_keys' ? (c->'cursor'->>'segment_key')
 when 'problems' then exists(select 1 from jsonb_array_elements_text(coalesce(s->'problem_keys','[]')) k where coalesce(c->'problem_keys','[]') ? k)
 else false end,false)
$$;
create or replace function private.task_resolve_materials(p_user uuid,p_course uuid,p_scope jsonb,p_selector jsonb,p_content jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare ids jsonb;begin
 if not exists(select 1 from public.task_courses where id=p_course and user_id=p_user) then raise exception 'course_not_owned' using errcode='42501';end if;
 if p_selector->>'kind'='none' then return '{"status":"not_required","asset_ids":[]}';end if;
 select coalesce(jsonb_agg(a.id order by a.id),'[]') into ids from public.material_assets a where a.status='ready' and
 case when p_selector->>'kind'='assets' then coalesce(p_selector->'asset_ids','[]') ? a.id::text
 when p_selector->>'kind'='auto' then exists(select 1 from public.course_material_links l where l.user_id=p_user and l.course_id=p_course and l.asset_id=a.id and private.material_scope_matches(l.scope,p_content)) else false end;
 return jsonb_build_object('status',case when jsonb_array_length(ids)>0 then 'selected' else 'pending' end,'asset_ids',ids);
end $$;

-- Freeze effective selection with generated tasks; later binding edits must not rewrite pending history.
alter table public.task_instances add column material_selector_snapshot jsonb;
update public.task_instances t set material_selector_snapshot=coalesce((select b.material_override from public.task_course_pool_bindings b where b.user_id=t.user_id and b.course_id=t.course_id and b.pool_item_id=t.template_id),t.template_snapshot->'material_selector','{"kind":"auto"}'::jsonb);
create function private.material_snapshot_selector() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.template_snapshot is distinct from old.template_snapshot then
 new.material_selector_snapshot:=coalesce((select b.material_override from public.task_course_pool_bindings b where b.user_id=new.user_id and b.course_id=new.course_id and b.pool_item_id=new.template_id),new.template_snapshot->'material_selector','{"kind":"auto"}'::jsonb);
 end if;return new;end $$;
create trigger material_snapshot_selector before insert or update on public.task_instances for each row execute function private.material_snapshot_selector();
revoke all on function private.material_snapshot_selector() from public,anon,authenticated;

-- Refresh only pending tasks; preserve completed/cancelled snapshots and historical asset IDs.
create function private.material_refresh_pending(u uuid,c uuid) returns void language plpgsql set search_path='' as $$
declare t public.task_instances;r jsonb;selector jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 for t in select * from public.task_instances where user_id=u and course_id=c and material_status='pending' and status not in ('completed','cancelled') order by id for update loop
 selector:=coalesce(t.material_selector_snapshot,'{"kind":"auto"}'::jsonb);
 r:=private.task_resolve_materials(u,c,'{"kind":"all"}',selector,t.content_snapshot);
 if r->>'status'<>'pending' then
 insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(u,t.id,t.revision,'material_resolution',jsonb_build_object('task',to_jsonb(t))) on conflict do nothing;
 update public.task_instances set material_status=r->>'status',material_assets=r->'asset_ids',revision=revision+1 where id=t.id;
 end if;end loop;
end $$;
create function public.material_save_asset(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();a public.material_assets;h text;begin
 if u is null then raise exception 'login_required' using errcode='42501';end if;
 if p_input->>'id' is not null then
 select * into strict a from public.material_assets where id=(p_input->>'id')::uuid for update;
 if a.created_by<>u and coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'asset_not_owned' using errcode='42501';end if;
 if p_input ? 'status' and p_input->>'status' is distinct from a.status and p_input->>'status'<>'archived' then raise exception 'readiness_is_server_owned';end if;
 -- Content replacement is a new asset/version, never a mutation of historical content.
 if p_input ? 'text_content' and p_input->>'text_content' is distinct from a.text_content or p_input ? 'href' and p_input->>'href' is distinct from a.href or p_input ? 'kind' and p_input->>'kind' is distinct from a.kind then raise exception 'create_new_asset_for_content';end if;
 update public.material_assets set title=coalesce(p_input->>'title',title),subject=coalesce(p_input->>'subject',subject),status=coalesce(p_input->>'status',status) where id=a.id returning * into a;
 else
 if p_input->>'kind' not in ('text','link') then raise exception 'file_transport_not_available';end if;
 h:=p_input->>'href';
 if p_input->>'kind'='link' and (h is null or h !~ '^(https://[^/@[:space:]]+|/[^/])' or h ~ '[\\[:space:]]' or h ~* '(access_token|refresh_token|token|signature|authorization)=' or h ~ '^https://[^/]*@') then raise exception 'invalid_material_link';end if;
 if p_input->>'kind'='text' and length(trim(coalesce(p_input->>'text_content','')))=0 then raise exception 'text_required';end if;
 insert into public.material_assets(subject,kind,title,created_by,text_content,href,mime_type) values(p_input->>'subject',p_input->>'kind',p_input->>'title',u,case when p_input->>'kind'='text' then p_input->>'text_content' end,case when p_input->>'kind'='link' then h end,case when p_input->>'kind'='text' then 'text/plain' else 'text/uri-list' end) returning * into a;
 end if;return to_jsonb(a);end $$;
create function public.material_link_course(p_course uuid,p_links jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v jsonb;s jsonb;k text;row public.course_material_links;result jsonb:='[]';snap public.task_course_catalog_snapshots;begin
 if u is null or not exists(select 1 from public.task_courses where id=p_course and user_id=u) then raise exception 'course_not_owned' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>200 then raise exception 'invalid_links';end if;
 select x.* into snap from public.task_course_catalog_snapshots x join public.task_courses c on c.catalog_snapshot_id=x.id where c.id=p_course and c.user_id=u;
 for v in select value from jsonb_array_elements(p_links) loop
 if not exists(select 1 from public.material_assets where id=(v->>'asset_id')::uuid and status='ready') then raise exception 'asset_not_ready';end if;
 s:=v->'scope';
 if s->>'kind'='unit' then
 if not exists(select 1 from jsonb_array_elements(snap.ordered_lessons) l where l->>'book'=s->>'book' and l->>'unit'=s->>'unit') then raise exception 'unknown_scope_unit';end if;
 elsif s->>'kind' in ('lessons','segments','problems') then
 k:=case s->>'kind' when 'lessons' then 'lesson_keys' when 'segments' then 'segment_keys' else 'problem_keys' end;
 if jsonb_typeof(s->k)<>'array' or jsonb_array_length(s->k)=0 then raise exception 'empty_scope';end if;
 if exists(select 1 from jsonb_array_elements_text(s->k) key where not(case s->>'kind' when 'lessons' then exists(select 1 from jsonb_array_elements(snap.ordered_lessons) l where l->>'key'=key) when 'segments' then exists(select 1 from jsonb_array_elements(snap.teaching_segments) x where x->>'key'=key) else exists(select 1 from jsonb_array_elements(snap.teaching_segments) x where x->'problem_keys' ? key) end)) then raise exception 'unknown_scope_key';end if;
 elsif s->>'kind' is distinct from 'all' then raise exception 'invalid_scope';end if;
 insert into public.course_material_links(user_id,course_id,asset_id,scope,role,sort_order) values(u,p_course,(v->>'asset_id')::uuid,s,coalesce(v->>'role','general'),coalesce((v->>'sort_order')::int,0)) on conflict(user_id,course_id,asset_id,scope,role) do update set sort_order=excluded.sort_order returning * into row;
 result:=result||jsonb_build_array(to_jsonb(row));end loop;
 perform private.material_refresh_pending(u,p_course);return result;end $$;
create function public.material_unlink_course(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from public.course_material_links where id=p_link and user_id=u) then raise exception 'link_not_owned' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 delete from public.course_material_links where id=p_link and user_id=u;
end $$;
create function public.material_refresh_pending(p_course uuid) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not exists(select 1 from public.task_courses where id=p_course and user_id=auth.uid()) then raise exception 'course_not_owned' using errcode='42501';end if;perform private.material_refresh_pending(auth.uid(),p_course);end $$;
revoke all on function private.material_scope_matches(jsonb,jsonb),private.material_refresh_pending(uuid,uuid),private.task_resolve_materials(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.material_save_asset(jsonb),public.material_link_course(uuid,jsonb),public.material_unlink_course(uuid),public.material_refresh_pending(uuid) from public,anon;
grant execute on function public.material_save_asset(jsonb),public.material_link_course(uuid,jsonb),public.material_unlink_course(uuid),public.material_refresh_pending(uuid) to authenticated;
