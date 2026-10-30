import EmbeddedPostgres from '/private/tmp/task4-postgres/node_modules/embedded-postgres/dist/index.js';
import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname;
const server=new EmbeddedPostgres({databaseDir:'/private/tmp/task10-postgres-data',user:'postgres',password:'task4-local-fixture',port:55450,persistent:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1','-k','/private/tmp/task4-postgres'],onLog:()=>{},onError:e=>console.error(String(e))});
await server.initialise(); await server.start();
const client=server.getPgClient(); await client.connect();
const db={exec:sql=>client.query(sql),query:(sql,args)=>client.query(sql,args),close:async()=>{await client.end();await server.stop()}};
let failures=0;
try {
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema public,auth,storage to authenticated,anon,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`);
for (const name of (await fs.readdir(`${root}/supabase/migrations`)).filter(n=>n.includes('task') || n.includes('independent_tasks') || n.includes('shared_material') || n.includes('baidu_oauth') || n.includes('baidu_refresh_lease') || n.includes('materials_directory_scans') || n.includes('material_upload_sessions')).sort()) {
 if(name.includes('tasks_background_generation'))await db.exec(await fs.readFile(`${root}/supabase/tests/task-generation-legacy-seed.sql`,'utf8'));
 if(process.argv.includes('--projection-baseline') && name.includes('tasks_processed_preview_projection')) continue;
 if(process.argv.includes('--baseline') && name.includes('tasks_event_lifecycle_repairs')) continue;
 if(name.includes('task_availability_configuration')) await db.exec(`insert into auth.users(id) values('10101010-3333-4333-8333-333333333333'); insert into public.task_availability_windows(user_id,weekday,on_date,start_time,end_time) values('10101010-3333-4333-8333-333333333333',6,null,'09:00','10:00');`);
 await db.exec(await fs.readFile(`${root}/supabase/migrations/${name}`,'utf8'));
 if(name.includes('task_availability_configuration')) await db.exec(`do $$begin if not exists(select 1 from public.task_availability_day_states where user_id='10101010-3333-4333-8333-333333333333' and weekday=6 and state='configured') then raise exception 'legacy backfill lost'; end if; end $$;`); console.log('Installed '+name);
}

for(const name of ['task-availability-capacity.sql','task-fixed-execution-window.sql']) {
 try { await db.exec(await fs.readFile(`${root}/supabase/tests/${name}`,'utf8')); console.log(name+' PASS'); }
 catch(e) { console.error(name+' FAIL: '+e.message+' '+e.where); await db.exec('rollback'); failures++; }
}
} catch(e) { failures++; console.error(e.message,e.where); } finally {console.log(`Validation result: ${failures} failure(s)`);await db.close();process.exit(failures?1:0)}
