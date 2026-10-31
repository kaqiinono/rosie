-- Verified account identity is not the constant primary credential row key.
alter table public.baidu_oauth_credentials add column account_id text,add column account_generation uuid;
create function public.baidu_store_verified_credentials(p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare prior public.baidu_oauth_credentials;g uuid;begin
 if coalesce(p_input->>'account_id','') !~ '^[1-9][0-9]{0,19}$' then raise exception 'invalid_identity';end if;
 perform pg_advisory_xact_lock(819233);
 select * into prior from public.baidu_oauth_credentials where id='primary' for update;
 g:=case when prior.account_id=p_input->>'account_id' and prior.account_generation is not null then prior.account_generation else gen_random_uuid() end;
 insert into public.baidu_oauth_credentials(id,app_key,access_token,refresh_token,expires_at,scope,authorized_by,updated_at,account_id,account_generation)
 values('primary',p_input->>'app_key',p_input->>'access_token',p_input->>'refresh_token',(p_input->>'expires_at')::timestamptz,p_input->>'scope',(p_input->>'authorized_by')::uuid,now(),p_input->>'account_id',g)
 on conflict(id) do update set app_key=excluded.app_key,access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,scope=excluded.scope,authorized_by=excluded.authorized_by,updated_at=now(),account_id=excluded.account_id,account_generation=g,refresh_lock_id=null,refresh_lock_until=null;
 if prior.account_generation is distinct from g then
 update public.material_assets set status='account_mismatch' where source='baidu' and status<>'archived' and account_id is distinct from p_input->>'account_id';
 end if;
end $$;
revoke all on function public.baidu_store_verified_credentials(jsonb) from public,anon,authenticated;
grant execute on function public.baidu_store_verified_credentials(jsonb) to service_role;
create table public.material_scan_sessions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),account_id text not null,account_generation uuid not null,
 root_id text not null,path text not null,recursive boolean not null,subject text not null,state jsonb not null,revision integer not null default 0,updated_at timestamptz not null default now()
);
alter table public.material_scan_sessions enable row level security;
revoke all on public.material_scan_sessions from public,anon,authenticated;
grant all on public.material_scan_sessions to service_role;
-- Credential lock serializes callback switching with publication. Stale workers cannot leak assets.
create function public.material_publish_scan(p_id uuid,p_user uuid,p_revision integer,p_account text,p_generation uuid,p_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.material_scan_sessions;f jsonb;a uuid;result jsonb:='[]';begin
 perform 1 from public.baidu_oauth_credentials where id='primary' and account_id=p_account and account_generation=p_generation for update;
 if not found then raise exception 'baidu_account_changed';end if;
 select * into strict s from public.material_scan_sessions where id=p_id and user_id=p_user for update;
 if s.account_id<>p_account or s.account_generation<>p_generation or s.revision<>p_revision then raise exception 'scan_stale';end if;
 for f in select value from jsonb_array_elements(p_state->'entries') loop
 if f->>'account_id'<>p_account or f->>'fs_id' !~ '^[1-9][0-9]{0,19}$' or not starts_with(f->>'path',s.path||'/') then raise exception 'invalid_scan_entry';end if;
 if not (f->>'isdir')::boolean then
 insert into public.material_assets(subject,kind,source,account_id,fs_id,path,title,mime_type,size,created_by)
 values(s.subject,'file','baidu',p_account,f->>'fs_id',f->>'path',left(f->>'name',240),f->>'mime',(f->>'size')::bigint,p_user)
 on conflict(account_id,fs_id,version) where source='baidu' do update set path=excluded.path,status=case when material_assets.status='archived' then 'archived' else 'ready' end
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
