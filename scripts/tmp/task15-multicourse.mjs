import {createJiti} from 'jiti';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname;const jiti=createJiti(import.meta.url);
const {buildTaskPlanningInput}=await jiti.import(`${root}/apps/web/src/lib/task-planning-input.ts`);const {solveCapacityPolicies,buildPlanningRisks}=await jiti.import(`${root}/packages/tasks/src/planning/index.ts`);
const results=JSON.parse(await fs.readFile(`${root}/scripts/tmp/task15-planning-results.json`));const fixture=JSON.parse(await fs.readFile(`${root}/supabase/tests/fixtures/course-runtime.json`));const now=results.normal.input.now,u=results.courses[0].user_id;
const snapshot={user_id:u,input_revision:100,courses:[],rules:[],exceptions:[],occurrences:[],events:[],catalog_snapshots:[],bindings:[],pool_items:[],tasks:[],day_states:[],windows:[],blocks:[],exams:[],previous_allocations:[],material_assets:[],material_links:[]};
for(let k=0;k<3;k++){
 const id=`course-${k}`;snapshot.courses.push({id,user_id:u,name:['数学合成课程','英语合成课程','美术合成课程'][k],subject:'art',created_at:now,auto_assign:true,auto_advance:false});
 snapshot.rules.push({id:`rule-${k}`,user_id:u,course_id:id,kind:'timetabled',weekday:k+1,start_time:'16:00',end_time:'17:00',valid_from:'2026-10-01',valid_until:null});
 snapshot.pool_items.push({...fixture.matching[0].items[0],id:`pool-${k}`,user_id:u,activity_key:`accept-${k}`,scope:{kind:'all'},lesson_filter:null,trigger:'after_class',target:'current',deadline:{kind:'same_day',days:0,time:'20:30',at:null},material_selector:{kind:'none'},estimated_minutes:20,enabled:true});
 snapshot.bindings.push({id:`binding-${k}`,user_id:u,course_id:id,pool_item_id:`pool-${k}`,enabled:true,scope_override:null,material_override:null,estimated_minutes_override:null});
 snapshot.tasks.push({...results.tasks[0],id:`actual-${k}`,course_id:id,source_key:`accept-actual-${k}`,due_at:new Date(Date.parse(now)+7*86400000).toISOString(),release_at:now,material_status:'not_required',selection_state:'selected',progress_mode:'percentage',items:[]});
}
for(let d=0;d<7;d++){snapshot.day_states.push({id:`state-${d}`,user_id:u,weekday:d,on_date:null,state:'configured'});snapshot.windows.push({id:`window-${d}`,user_id:u,weekday:d,on_date:null,start_time:'18:00',end_time:'20:00',unavailable:false});}
const began=performance.now();const input=buildTaskPlanningInput(snapshot,now);const result=solveCapacityPolicies(input),risks=buildPlanningRisks(result.allow_weekend,{tight_ratio:.2},input);const elapsed=performance.now()-began;
assert(input.demands.some(d=>d.origin==='forecast'));assert(input.demands.some(d=>d.origin==='actual'));assert.equal(new Set(input.demands.map(d=>d.course_id)).size,3);
results.multicourse={input,result,risks};results.multicourse_courses=snapshot.courses;results.multicourse_tasks=snapshot.tasks;results.multicourse_timing={elapsed_ms:elapsed,demands:input.demands.length,forecast:input.demands.filter(d=>d.origin==='forecast').length,capacity:input.capacity.length,scope:'builder + both policies + risks only; synthetic 3-course 28-day, excludes module load/SQL; no production-scale claim'};
await fs.writeFile(`${root}/scripts/tmp/task15-planning-results.json`,JSON.stringify(results,null,2));console.log(results.multicourse_timing);
