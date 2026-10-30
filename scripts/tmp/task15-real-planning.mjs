import { createJiti } from 'jiti';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function validatePlanning(client, root) {
 const jiti=createJiti(import.meta.url,{alias:{'@rosie/tasks/planning':`${root}/packages/tasks/src/planning/index.ts`}});
 const {buildTaskPlanningInput}=await jiti.import(`${root}/apps/web/src/lib/task-planning-input.ts`);
 const {solveCapacityPolicies,buildPlanningRisks}=await jiti.import(`${root}/packages/tasks/src/planning/index.ts`);
 const u='15151515-1515-4515-8515-151515151515';
 const q=async(sql,args=[]) => (await client.query(sql,args)).rows;
 await q('insert into auth.users values($1)',[u]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 await q("select public.task_initialize('[]'::jsonb)");
 const date=(await q("select ((clock_timestamp() at time zone 'Asia/Shanghai')::date+1)::text d"))[0].d;
 const start=`${date}T09:00:00+08:00`,due=`${date}T12:00:00+08:00`;
 const task=(await q("select public.task_save_execution($1,null) t",[{title:'Acceptance real demand',subject:'other',estimated_minutes:30,due_at:due}]))[0].t;
 await q("select public.task_set_availability(null,$1,'configured','09:00','10:00')",[date]);
 const j=(await q('select * from public.task_claim_planning_jobs(1,$1)',[u]))[0];
 const snap=(await q('select public.task_planning_input($1) s',[u]))[0].s;
 const began=performance.now();const input=buildTaskPlanningInput(snap,snap.now),result=solveCapacityPolicies(input),risks=buildPlanningRisks(result.allow_weekend,{tight_ratio:snap.tight_ratio},input);
 const elapsed=performance.now()-began;
 assert(input.demands.some(d=>d.task_id===task.id));
 const allocations=result.allow_weekend.allocations.filter(a=>input.demands.some(d=>d.key===a.demand_key&&d.task_id===task.id));
 assert.equal(allocations.reduce((n,a)=>n+a.minutes,0),30);
 assert.equal((await q("select public.task_publish_planning($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '1 minute') ok",[u,j.lease_id,snap.shared_revision,input,result,risks]))[0].ok,true);
 let status=(await q('select public.task_planning_status() s'))[0].s;
 assert.equal(status.stale,false);assert.deepEqual(status.snapshot.result,result);const publishedStatus=structuredClone(status);
 assert.equal((await q('select public.task_accept_plan($1,$2) n',[input.input_revision,JSON.stringify(allocations)]))[0].n,allocations.length);
 assert.equal(Number((await q('select count(*) n from public.task_time_blocks where user_id=$1',[u]))[0].n),allocations.length);
 status=(await q('select public.task_planning_status() s'))[0].s;assert.equal(status.stale,true);
 const old=(await q("select public.task_save_execution($1,null) t",[{title:'Recovery acceptance',subject:'other',estimated_minutes:20,due_at:'2020-01-01T00:00:00Z'}]))[0].t;
 const saved=(await q('select public.task_save_execution($1,$2) t',[{id:old.id,recovery_due_at:due},old.revision]))[0].t;
 assert.equal(saved.due_at,old.due_at);assert.equal(Date.parse(saved.recovery_due_at),Date.parse(due));
 const outcomes={courses:snap.courses,tasks:snap.tasks,normal:{snapshot:publishedStatus,input,result,risks},timing:{elapsed_ms:elapsed,demands:input.demands.length,capacity:input.capacity.length,limit:'synthetic local smoke; not production scale'}};
 for(const [label,edit] of Object.entries({zero:s=>{s.windows=[];s.day_states=s.day_states.map(d=>({...d,state:'zero'}))},incomplete:s=>{s.tasks[0].material_status='pending'},undated:s=>{s.tasks[0].due_at=null;s.tasks[0].recovery_due_at=null;s.blocks=[]},stale:s=>{s.input_revision++}})) {
  const copy=structuredClone(snap);edit(copy);const i=buildTaskPlanningInput(copy,copy.now);const r=solveCapacityPolicies(i);outcomes[label]={input:i,result:r,risks:buildPlanningRisks(r.allow_weekend,{tight_ratio:copy.tight_ratio},i)};
 }
 await fs.writeFile(`${root}/scripts/tmp/task15-planning-results.json`,JSON.stringify(outcomes,null,2));
 console.log(`REAL snapshot -> canonical builder/solver -> atomic publish/status -> persisted adoption/recovery PASS; ${elapsed.toFixed(1)}ms, ${input.demands.length} demands`);
}
