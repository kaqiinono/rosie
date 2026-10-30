-- Server-only upload state. Credential lock uses the Task8 account-switch serialization order.
create table public.material_upload_sessions(
 id uuid primary key,user_id uuid not null references auth.users(id),account_id text not null,account_generation uuid not null,
 path text not null unique,name text not null,subject text not null,mime text not null,size bigint not null check(size>0),hashes jsonb not null,
 upload_id text,state text not null default 'initializing' check(state in('initializing','preparing','uploading','merging','ready','cancelled')),
 parts jsonb not null default '{}',asset_id uuid references public.material_assets(id),updated_at timestamptz not null default now()
);
alter table public.material_upload_sessions enable row level security;
revoke all on public.material_upload_sessions from public,anon,authenticated;
grant all on public.material_upload_sessions to service_role;
create function public.material_upload_transition(p_id uuid,p_user uuid,p_account text,p_generation uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.material_upload_sessions;a uuid;n integer;i integer;claimed boolean:=false;begin
 perform 1 from public.baidu_oauth_credentials where id='primary' and account_id=p_account and account_generation=p_generation for update;
 if not found then raise exception 'baidu_account_changed';end if;
 if p_action='new' then
 insert into public.material_upload_sessions(id,user_id,account_id,account_generation,path,name,subject,mime,size,hashes)
 values(p_id,p_user,p_account,p_generation,p_data->>'path',p_data->>'name',p_data->>'subject',p_data->>'mime',(p_data->>'size')::bigint,p_data->'hashes');
 end if;
 select * into strict s from public.material_upload_sessions where id=p_id and user_id=p_user for update;
 if s.account_id<>p_account or s.account_generation<>p_generation then raise exception 'baidu_account_changed';end if;
 if p_action='prepareclaim' and s.state='initializing' then
 update public.material_upload_sessions set state='preparing' where id=p_id;claimed:=true;
 elsif p_action='prepared' then
 if s.state<>'preparing' then raise exception 'upload_state';end if;
 update public.material_upload_sessions set upload_id=p_data->>'upload_id',parts=p_data->'parts',state=case when (p_data->>'rapid')::boolean then 'merging' else 'uploading' end where id=p_id;
 elsif p_action='part' then
 i:=(p_data->>'index')::integer;
 if s.state<>'uploading' or i<0 or i>=jsonb_array_length(s.hashes) or p_data->>'hash'<>s.hashes->>i then raise exception 'upload_part';end if;
 update public.material_upload_sessions set parts=jsonb_set(parts,array[i::text],to_jsonb(p_data->>'hash')) where id=p_id;
 elsif p_action='claim' and s.state='uploading' then
 n:=jsonb_array_length(s.hashes);
 for i in 0..n-1 loop if s.parts->>i::text is distinct from s.hashes->>i then raise exception 'upload_incomplete';end if;end loop;
 update public.material_upload_sessions set state='merging' where id=p_id;claimed:=true;
 elsif p_action='claim' and s.state='preparing' then
 update public.material_upload_sessions set state='merging' where id=p_id;
 elsif p_action='cancel' then
 if s.state='ready' then raise exception 'already_ready';end if;
 update public.material_upload_sessions set state='cancelled' where id=p_id;
 elsif p_action='publish' then
 if s.state='ready' then return to_jsonb(s);end if;
 if s.state<>'merging' or p_data->>'path'<>s.path or (p_data->>'size')::bigint<>s.size or p_data->>'fs_id' !~ '^[1-9][0-9]{0,19}$' then raise exception 'upload_verification';end if;
 insert into public.material_assets(subject,kind,source,account_id,fs_id,path,title,mime_type,size,created_by,status)
 values(s.subject,case when s.mime in('image/jpeg','image/png','image/gif','image/webp','image/avif') then 'image' when s.mime in('audio/mpeg','audio/mp4','audio/wav','audio/ogg') then 'audio' when s.mime in('video/mp4','video/webm','video/ogg') then 'video' when s.mime='application/pdf' then 'pdf' else 'file' end,'baidu',s.account_id,p_data->>'fs_id',s.path,s.name,s.mime,s.size,p_user,'ready')
 on conflict(account_id,fs_id,version) where source='baidu' do update set path=excluded.path returning id into a;
 update public.material_upload_sessions set state='ready',asset_id=a where id=p_id;
 end if;
 update public.material_upload_sessions set updated_at=now() where id=p_id returning * into s;
 return to_jsonb(s)||jsonb_build_object('claimed',claimed);
end $$;
revoke all on function public.material_upload_transition(uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.material_upload_transition(uuid,uuid,text,uuid,text,jsonb) to service_role;
