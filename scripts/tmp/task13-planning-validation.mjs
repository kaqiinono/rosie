import EmbeddedPostgres from '/private/tmp/task4-postgres/node_modules/embedded-postgres/dist/index.js';
import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname;
const server=new EmbeddedPostgres({databaseDir:'/private/tmp/task13-postgres-data',user:'postgres',password:'task4-local-fixture',port:55453,persistent:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1','-k','/private/tmp/task4-postgres'],onLog:()=>{},onError:e=>console.error(String(e))});
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

for(const name of ['task-availability-capacity.sql','task-fixed-execution-window.sql','task-planning-jobs.sql']) {
 try { await db.exec(await fs.readFile(`${root}/supabase/tests/${name}`,'utf8')); console.log(name+' PASS'); }
 catch(e) { console.error(name+' FAIL: '+e.message+' '+e.where); await db.exec('rollback'); failures++; }
}
// Real connections claim the same owner concurrently; only one can hold its lease.
const second=server.getPgClient(); await second.connect();
try {
const owner='13131313-2222-4222-8222-131313131313';
await db.exec(`insert into auth.users values('${owner}');insert into public.task_user_planning_revisions(user_id) values('${owner}');`);
const [a,b]=await Promise.all([client.query('select * from public.task_claim_planning_jobs(1,$1)',[owner]),second.query('select * from public.task_claim_planning_jobs(1,$1)',[owner])]);
if(a.rows.length+b.rows.length!==1)throw Error('double lease claim');
const lease=(a.rows[0]??b.rows[0]).lease_id;
await second.query('begin');
await second.query("insert into public.material_assets(subject,kind,title,created_by) values('other','text','uncommitted asset',$1)",[owner]);
const snap=(await client.query('select public.task_planning_input($1) s',[owner])).rows[0].s;
const input={input_revision:snap.input_revision,now:new Date().toISOString(),horizon_end:new Date(Date.now()+86400000).toISOString(),demands:[]};
if(snap.material_assets.some(a=>a.title==='uncommitted asset'))throw Error('snapshot leaked uncommitted material');
await second.query('commit');
const publish=()=>client.query('select public.task_publish_planning($1,$2,$3,$4,$5,$6,clock_timestamp()+interval \'1 minute\') ok',[owner,lease,snap.shared_revision,input,{allow_weekend:{allocations:[]}},{ }]);
if((await publish()).rows[0].ok)throw Error('stale material epoch published');
await client.query('update public.task_planning_jobs set lease_id=$2,lease_until=clock_timestamp()-interval \'1 second\' where user_id=$1',[owner,lease]);
const newer=(await second.query('select * from public.task_claim_planning_jobs(1,$1)',[owner])).rows[0];
if(!newer || newer.lease_id===lease)throw Error('interrupted worker not reclaimed');
if((await publish()).rows[0].ok)throw Error('old lease published after reclaim');
const fresh=(await second.query('select public.task_planning_input($1) s',[owner])).rows[0].s;
const freshInput={...input,now:new Date().toISOString()};
const publicationArgs=[owner,newer.lease_id,fresh.shared_revision,freshInput,{allow_weekend:{allocations:[]}},{ }];
const publicationSql="select public.task_publish_planning($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '1 minute') ok";
const pair=await Promise.all([client.query(publicationSql,publicationArgs),second.query(publicationSql,publicationArgs)]);
if(pair.filter(r=>r.rows[0].ok).length!==1)throw Error('double publication won');
await second.query("update public.task_planning_snapshots set next_recompute_at=clock_timestamp()-interval '1 second' where user_id=$1",[owner]);
await second.query('update public.task_planning_jobs set next_attempt_at=clock_timestamp() where user_id=$1',[owner]);
const sameRevision=(await second.query('select * from public.task_claim_planning_jobs(1,$1)',[owner])).rows[0];
const earlierInput={...freshInput,now:new Date(Date.parse(freshInput.now)-1000).toISOString()};
if((await client.query(publicationSql,[owner,sameRevision.lease_id,fresh.shared_revision,earlierInput,{allow_weekend:{allocations:[]}},{ }])).rows[0].ok)throw Error('older same-revision result overwrote snapshot');
const ownerChangeClaim=(await client.query('select * from public.task_claim_planning_jobs(1,$1)',[owner])).rows[0];
await second.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
await second.query('select public.task_set_planning_settings(.4)');
if((await client.query(publicationSql,[owner,ownerChangeClaim.lease_id,fresh.shared_revision,{...freshInput,now:new Date().toISOString()},{allow_weekend:{allocations:[]}},{ }])).rows[0].ok)throw Error('old owner revision published');
console.log('Real two-connection claim / material MVCC / interruption / publication / monotonic / owner-revision races PASS');
}finally{await second.end()}
} catch(e) { failures++; console.error(e.message,e.where); } finally {console.log(`Validation result: ${failures} failure(s)`);await db.close();process.exit(failures?1:0)}
