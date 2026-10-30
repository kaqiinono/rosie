import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import PlanningDashboard from '../../packages/tasks/src/components/planning/PlanningDashboard'
import {TasksContext} from '../../packages/tasks/src/components/shared'
import RecoveryTargetEditor from '../../packages/tasks/src/components/planning/RecoveryTargetEditor'
import fixture from './task15-planning-results.json'
const mode=new URLSearchParams(location.search).get('mode')||'normal'
const selected=fixture[mode]||fixture.normal
const status={...fixture.normal.snapshot,stale:mode==='stale',snapshot:{...fixture.normal.snapshot.snapshot,input:selected.input,result:selected.result,risks:selected.risks}}
Date.now=()=>Date.parse(selected.input.now)+1000
const initial=mode==='normal'?await fetch('/state').then(r=>r.json()):{courses:mode==='multicourse'?fixture.multicourse_courses:fixture.courses,tasks:mode==='multicourse'?fixture.multicourse_tasks:fixture.tasks,planning:status}
function Fixture(){const [notice,notify]=useState('');const [data,setData]=useState(initial);async function mutate(path,body){const response=await fetch(path,{method:'POST',body:JSON.stringify(body)});const saved=await response.json();if(!response.ok)throw Error(saved.error);setData(saved);notify('真实SQL已保存');}
const api={data,requestPlanning:async()=>setData(await fetch('/state').then(r=>r.json())),setPlanningSettings:async()=>{},acceptPlan:async(revision,allocations)=>mutate('/adopt',{revision,allocations}),setRecoveryDue:async(id,due,revision)=>mutate('/recover',{id,due,revision})} as never
return <TasksContext.Provider value={{api,catalog:{} as never,busy:false,notify,run:async w=>{await w();return true}}}><main className="mx-auto max-w-7xl space-y-4 bg-slate-50 p-4 text-slate-800"><p>隔离合成身份：SQL快照→真实builder/solver→持久发布结果；关键采纳/恢复通过本地SQL adapter；非真实登录。</p><p role="status">{notice}</p><PlanningDashboard/>{mode==='normal'&&data.tasks.filter(t=>t.title==='Recovery acceptance').map(t=><RecoveryTargetEditor key={t.revision} task={t} now={Date.now()}/>)}</main></TasksContext.Provider>}
createRoot(document.getElementById('root')!).render(<Fixture/>)
