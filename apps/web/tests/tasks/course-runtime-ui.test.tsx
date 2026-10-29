import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect,it } from 'vitest'
import CourseDeadlineFields from '../../../../packages/tasks/src/components/timetable/CourseDeadlineFields'
import type { CourseDeadlinePolicy } from '../../../../packages/tasks/src/courseTypes'
it('switching to fixed deadline normalizes hidden invalid day/time values',()=>{
 let saved: CourseDeadlinePolicy|null=null
 function Form(){const [value,setValue]=useState<CourseDeadlinePolicy|null>({kind:'next_class',days:1,time:'20:30',at:null});return <form onSubmit={e=>{e.preventDefault();saved=value}}><CourseDeadlineFields value={value} flexible onChange={setValue}/><button>Save</button></form>}
 render(<Form/>);
 fireEvent.change(screen.getByLabelText('自由课程提前天数'),{target:{value:''}})
 fireEvent.change(screen.getByLabelText('默认截止时刻'),{target:{value:''}})
 fireEvent.change(screen.getByLabelText('课程默认截止策略'),{target:{value:'fixed'}})
 fireEvent.change(screen.getByLabelText('固定截止日期时间'),{target:{value:'2026-11-01T20:30'}})
 fireEvent.click(screen.getByRole('button',{name:'Save'}))
 expect(saved).toEqual({kind:'fixed',days:1,time:'20:30',at:'2026-11-01T20:30:00+08:00'})
})

import { vi } from 'vitest'
import CourseConfirm from '../../../../packages/tasks/src/components/CourseConfirm'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { CourseEvent } from '../../../../packages/tasks/src/courseTypes'
import fixtures from '../../../../supabase/tests/fixtures/course-runtime.json'
it('explicit completion calls the event RPC with its revision, even after auto assignment',async()=>{
 const event={...fixtures.matching[0].event,assignment_state:'assigned'} as CourseEvent
 const rpc=vi.fn().mockResolvedValue({...event,completion_state:'completed',revision:2})
 const api={data:{courses:[{id:event.course_id,name:'Read',subject:'english'}],catalog_snapshots:[],events:[event]},rpc} as unknown as TaskDataApi
 const close=vi.fn()
 render(<TasksContext.Provider value={{api,catalog:{english:[],chinese:[],math:[],loadMathProblems:async()=>[]},busy:false,notify:vi.fn(),run:async work=>{await work();return true}}}><CourseConfirm event={event} onClose={close}/></TasksContext.Provider>)
 fireEvent.click(screen.getByRole('button',{name:'完课并生成任务'}))
 await vi.waitFor(()=>expect(close).toHaveBeenCalled())
 expect(rpc).toHaveBeenCalledExactlyOnceWith('task_complete_event',{p_event_id:event.id,p_expected_revision:1})
})
