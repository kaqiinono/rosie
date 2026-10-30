import http from 'node:http';
import fs from 'node:fs/promises';
import {createJiti} from 'jiti';
export async function servePlanning(client,root){
 const jiti=createJiti(import.meta.url);
 const {buildTaskPlanningInput}=await jiti.import(`${root}/apps/web/src/lib/task-planning-input.ts`);
 const {solveCapacityPolicies,buildPlanningRisks}=await jiti.import(`${root}/packages/tasks/src/planning/index.ts`);
 const q=async(s,a=[]) => (await client.query(s,a)).rows;
 const owner='15151515-1515-4515-8515-151515151515';
 async function state(){
  const s=(await q('select public.task_planning_input($1) s',[owner]))[0].s;
  const input=buildTaskPlanningInput(s,s.now),result=solveCapacityPolicies(input),risks=buildPlanningRisks(result.allow_weekend,{tight_ratio:s.tight_ratio},input);
  const lease=(await q('select * from public.task_claim_planning_jobs(1,$1)',[owner]))[0];
  if(lease) await q("select public.task_publish_planning($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '1 minute')",[owner,lease.lease_id,s.shared_revision,input,result,risks]);
  return {courses:s.courses,tasks:s.tasks,planning:(await q('select public.task_planning_status() s'))[0].s};
 }
 await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 let current=await state();const evidence=[];
 await new Promise(resolve=>{
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/state'){current=await state();res.setHeader('content-type','application/json');return res.end(JSON.stringify(current))}
  if(req.method==='POST' && ['/adopt','/recover'].includes(req.url)){
   let body='';for await(const c of req)body+=c;if(body.length>100000)throw Error('too large');const b=JSON.parse(body);
   if(req.url==='/adopt') {const n=(await q('select public.task_accept_plan($1,$2) n',[b.revision,JSON.stringify(b.allocations)]))[0].n;evidence.push({action:'browser adoption',saved_blocks:n});}
   else {const before=(await q('select due_at from public.task_instances where id=$1',[b.id]))[0];const after=(await q('select public.task_save_execution($1,$2) t',[{id:b.id,recovery_due_at:b.due},b.revision]))[0].t;if(Date.parse(before.due_at)!==Date.parse(after.due_at))throw Error('original deadline changed');evidence.push({action:'browser recovery',id:b.id,original_due_at:after.due_at,recovery_due_at:after.recovery_due_at});}
   current=await state();await fs.writeFile(`${root}/scripts/tmp/task15-browser-persistence.json`,JSON.stringify(evidence,null,2));res.setHeader('content-type','application/json');return res.end(JSON.stringify(current));
  }
  if(req.url==='/stop'){res.end('stopped');server.close(resolve);return}
  const file=req.url==='/fixture.js'?'fixture.js':req.url==='/production.css'?'production.css':'index.html';res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(`/private/tmp/task15-browser/${file}`));
 }catch(e){res.statusCode=409;res.end(JSON.stringify({error:e.message}))}});server.listen(3915,'127.0.0.1',()=>console.log('Synthetic identity SQL browser adapter at http://127.0.0.1:3915'));});
}
