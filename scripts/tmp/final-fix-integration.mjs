import assert from 'node:assert/strict';
import {createJiti} from 'jiti';
export async function validateFinalFix(client,root){
 const q=async(s,a=[]) => (await client.query(s,a)).rows;
 const jiti=createJiti(import.meta.url,{fsCache:false,alias:{'@rosie/tasks/planning':`${root}/packages/tasks/src/planning/index.ts`}});
 const {buildTaskPlanningInput}=await jiti.import(`${root}/apps/web/src/lib/task-planning-input.ts`);
 const {solveCapacityPolicies,buildPlanningRisks}=await jiti.import(`${root}/packages/tasks/src/planning/index.ts`);
 const u='16161616-1616-4616-8616-161616161616';
 await q('insert into auth.users values($1)',[u]); await q("select set_config('request.jwt.claim.sub',$1,false)",[u]);await q("select public.task_initialize('[]'::jsonb)");
 const credentials=account=>({account_id:account,scope:'basic,netdisk',app_key:'fixture',access_token:'fixture',refresh_token:'fixture',expires_at:'2099-01-01',authorized_by:u});
 await q('select public.baidu_store_verified_credentials($1)',[credentials('123')]);
 const gen=(await q("select account_generation from public.baidu_oauth_credentials where id='primary'"))[0].account_generation;
 const entries=['MP3','JPEG','pdf','svg'].map((ext,i)=>({account_id:'123',fs_id:String(600+i),path:`/airosie/english/file.${ext}`,name:`file.${ext}`,size:1,isdir:false,mime:'text/html'}));
 const scan=(await q("insert into public.material_scan_sessions(user_id,account_id,account_generation,root_id,path,recursive,subject,state) values($1,'123',$2,'english','/airosie/english',false,'english','{}') returning id",[u,gen]))[0].id;
 await q('select public.material_publish_scan($1,$2,0,$3,$4,$5)',[scan,u,'123',gen,{entries,queue:[],complete:true}]);
 const assets=await q("select * from public.material_assets where account_id='123' order by fs_id");
 assert.deepEqual(assets.map(a=>[a.kind,a.mime_type]),[['audio','audio/mpeg'],['image','image/jpeg'],['pdf','application/pdf'],['file','application/octet-stream']]);
 const asset=assets[0];
 const date=(await q("select ((clock_timestamp() at time zone 'Asia/Shanghai')::date+1)::text d"))[0].d;
 for(let weekday=0;weekday<7;weekday++)await q("select public.task_set_availability($1,null,'configured','18:00','20:00')",[weekday]);
 const task=(await q('select public.task_save_execution($1,null) t',[{title:'Frozen selected media',subject:'english',estimated_minutes:20,due_at:`${date}T20:00:00+08:00`}]))[0].t;
 // Fixture setup only: real task writes subsequently remain through publication APIs.
 await q("update public.task_instances set material_status='selected',material_assets=$2 where id=$1",[task.id,JSON.stringify([asset.id])]);
 async function publish(expected){
  await q("update public.task_planning_jobs set next_attempt_at=clock_timestamp() where user_id=$1",[u]);
  const claim=(await q('select * from public.task_claim_planning_jobs(1,$1)',[u]))[0];assert(claim);
  const snap=(await q('select public.task_planning_input($1) s',[u]))[0].s;
  const input=buildTaskPlanningInput(snap,snap.now),result=solveCapacityPolicies(input),risks=buildPlanningRisks(result.allow_weekend,{tight_ratio:.2},input);
  assert.equal(result.allow_weekend.complete,expected);
  assert.equal((await q("select public.task_publish_planning($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '1 minute') ok",[u,claim.lease_id,snap.shared_revision,input,result,risks]))[0].ok,true);
  const status=(await q('select public.task_planning_status() s'))[0].s;assert.equal(status.stale,false);assert.equal(status.snapshot.result.allow_weekend.complete,expected);
  return snap;
 }
 const before=await publish(true);
 await q('select public.baidu_store_verified_credentials($1)',[credentials('124')]);
 const after=await publish(false);assert(after.shared_revision>before.shared_revision);
 assert.deepEqual(after.tasks.find(t=>t.id===task.id).material_assets,[asset.id]);
 await q("update public.material_assets set status='archived' where id=$1",[asset.id]);await publish(false);
 await q('select public.baidu_store_verified_credentials($1)',[credentials('123')]);await publish(true);
 assert.equal((await q('select status from public.material_assets where id=$1',[asset.id]))[0].status,'archived');
 console.log('Final fixes: native scan publication MP3/JPEG/PDF/unsafe; fresh published account-switch epoch + archived unreadable/readable with frozen IDs PASS');
}
