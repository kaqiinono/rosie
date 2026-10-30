import EmbeddedPostgres from '/private/tmp/task4-postgres/node_modules/embedded-postgres/dist/index.js';
import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname;
const server=new EmbeddedPostgres({databaseDir:'/private/tmp/task9-postgres-data',user:'postgres',password:'task4-local-fixture',port:55449,persistent:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1','-k','/private/tmp/task4-postgres'],onLog:()=>{},onError:e=>console.error(String(e))});
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
 await db.exec(await fs.readFile(`${root}/supabase/migrations/${name}`,'utf8')); console.log('Installed '+name);
}

// Two connections: account switches after capture but before the scan publication lock.
await db.exec(`insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
select public.baidu_store_verified_credentials('{"account_id":"100","app_key":"fixture","access_token":"a","refresh_token":"b","expires_at":"2099-01-01","scope":"basic"}');`);
const captured=(await db.query(`select account_generation from public.baidu_oauth_credentials`)).rows[0].account_generation;
const session=(await db.query(`insert into public.material_scan_sessions(user_id,account_id,account_generation,root_id,path,recursive,subject,state) values('33333333-3333-4333-8333-333333333333','100',$1,'english','/airosie/english',true,'english','{}') returning id`,[captured])).rows[0].id;
const switcher=server.getPgClient();await switcher.connect();
try {
 await switcher.query('begin');
 await switcher.query(`select public.baidu_store_verified_credentials('{"account_id":"200","app_key":"fixture","access_token":"c","refresh_token":"d","expires_at":"2099-01-01","scope":"basic"}')`);
 const publication=db.query(`select public.material_publish_scan($1,'33333333-3333-4333-8333-333333333333',0,'100',$2,'{"queue":[],"entries":[],"complete":true}')`,[session,captured]).then(()=>{throw Error('concurrent switch accepted stale scan')},e=>{if(e.message!=='baidu_account_changed')throw e});
 await switcher.query('commit');await publication;
 console.log('concurrent account switch publication PASS');
} finally {await switcher.end()}
// Upload publication uses the same credential-row lock, with two actual SQL connections.
await db.exec(`select public.baidu_store_verified_credentials('{"account_id":"100","app_key":"fixture","access_token":"a","refresh_token":"b","expires_at":"2099-01-01","scope":"basic"}')`);
const ug=(await db.query(`select account_generation from public.baidu_oauth_credentials`)).rows[0].account_generation;
const uid='33333333-3333-4333-8333-333333333333',upload='77777777-1111-4111-8111-111111111111';
await db.query(`select public.material_upload_transition($1,$2,'100',$3,'new','{"path":"/apps/race","name":"race","subject":"math","mime":"x","size":1,"hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]}')`,[upload,uid,ug]);
await db.query(`select public.material_upload_transition($1,$2,'100',$3,'prepareclaim')`,[upload,uid,ug]);
await db.query(`select public.material_upload_transition($1,$2,'100',$3,'prepared','{"upload_id":"up","rapid":true,"parts":{"0":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}')`,[upload,uid,ug]);
const us=server.getPgClient();await us.connect();
try{await us.query('begin');await us.query(`select public.baidu_store_verified_credentials('{"account_id":"200","app_key":"fixture","access_token":"a","refresh_token":"b","expires_at":"2099-01-01","scope":"basic"}')`);
const pub=db.query(`select public.material_upload_transition($1,$2,'100',$3,'publish','{"path":"/apps/race","size":1,"fs_id":"9007199254740993"}')`,[upload,uid,ug]).then(()=>{throw Error('stale upload published')},e=>{if(e.message!=='baidu_account_changed')throw e});await us.query('commit');await pub;console.log('concurrent upload account-switch publication PASS')}finally{await us.end()}
for(const name of ['material-independent-generation.sql','material-selector-revision.sql','material-rls.sql','material-scan.sql','material-upload.sql']) {
 try { await db.exec(await fs.readFile(`${root}/supabase/tests/${name}`,'utf8')); console.log(name+' PASS'); }
 catch(e) { console.error(name+' FAIL: '+e.message+' '+e.where); await db.exec('rollback'); failures++; }
}

} catch(e) { failures++; console.error(e.message,e.where); } finally {console.log(`Validation result: ${failures} failure(s)`);await db.close();process.exit(failures?1:0)}
