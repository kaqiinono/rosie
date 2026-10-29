'use client'

import { useState } from 'react'
import type { CourseOccurrence } from '../types'
import type { CourseCursor, CourseEvent } from '../courseTypes'
import { displayTime } from '../time'
import { useTasks, Panel, Field, buttonClass, inputClass, minorClass } from './shared'

type Props = { event?: CourseEvent; occurrence?: CourseOccurrence; onClose: () => void }
/** Explicit event actions. Automatic assignment never implies actual completion. */
export default function CourseConfirm({ event: supplied, occurrence, onClose }: Props) {
  const { api, run, busy } = useTasks()
  const event = supplied ?? api.data.events.find(e => e.occurrence_id === occurrence?.id)
  const course = api.data.courses.find(c => c.id === (event?.course_id ?? occurrence?.course_id))
  const snapshot = api.data.catalog_snapshots.find(s => s.id === course?.catalog_snapshot_id)
  const [cursor, setCursor] = useState<CourseCursor | null>(event?.lesson_snapshot?.cursor ?? course?.cursor ?? null)
  const [title, setTitle] = useState(event?.lesson_snapshot?.lesson?.title ?? occurrence?.confirmation?.lesson.title ?? '')
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState('')
  const action = async (complete: boolean) => {
    setError('')
    try {
      if (!event) {
        if (!occurrence || !title.trim()) throw new Error('请填写本次学习内容。')
        await api.rpc('task_confirm_course', { p_occurrence: occurrence.id, p_confirmation: { lesson: { key: occurrence.id, title: title.trim(), book: course?.name ?? '', unit: '', kind: 'manual' } } })
      } else {
        let revision = event.revision
        if (changed) {
          if (snapshot ? !cursor : !title.trim()) throw new Error('请选择或填写本次学习内容。')
          const content = snapshot ? { cursor } : { lesson: { ...(event.lesson_snapshot?.lesson ?? { key: event.id, book: course?.name ?? '', unit: '', kind: 'manual' }), title: title.trim() } }
          const revised = await api.rpc('task_revise_event', { p_event_id: event.id, p_content: content, p_expected_revision: revision }) as CourseEvent & { status?: string }
          if (revised.status === 'retry') throw new Error('课程历史补偿处理中，请稍后重试修改。')
          revision = revised.revision
        }
        if (complete) {
          const result = await api.rpc('task_complete_event', { p_event_id: event.id, p_expected_revision: revision }) as { status?: string }
          if (result?.status === 'retry') throw new Error('课程历史补偿处理中，请稍后重试完课。')
        }
      }
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。') }
  }
  return <Panel title={`本次学习 · ${course?.name ?? ''}`}>
    <p className="text-sm text-slate-500">{event?.starts_at ? displayTime(event.starts_at) : event?.on_date ?? (occurrence ? displayTime(occurrence.starts_at) : '')} · {event?.completion_state === 'completed' ? '已完课' : '尚未完课'}</p>
    <p className="text-sm text-slate-600">{event?.assignment_state === 'assigned' ? '任务已分配，完课不会重复生成。' : '完课将生成已绑定任务，并按课程设置推进下一次内容。'}</p>
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    <div className="space-y-3">
      {snapshot ? <>
        <Field label="本次目录项"><select className={inputClass} disabled={busy} value={cursor?.lesson_key ?? ''} onChange={e => { setChanged(true); setCursor({ lesson_key:e.target.value,segment_key:snapshot.progression_mode === 'segment' ? snapshot.teaching_segments.find(s=>s.lesson_key===e.target.value)?.key ?? null : null }) }}><option value="">请选择</option>{snapshot.ordered_lessons.map(l=><option key={l.key} value={l.key}>{l.book} · {l.unit} · {l.title}</option>)}</select></Field>
        {snapshot.progression_mode === 'segment' && <Field label="本次教学段"><select className={inputClass} disabled={busy} value={cursor?.segment_key ?? ''} onChange={e=>{if(cursor){setCursor({...cursor,segment_key:e.target.value});setChanged(true)}}}><option value="">请选择</option>{snapshot.teaching_segments.filter(s=>s.lesson_key===cursor?.lesson_key).map(s=><option key={s.key} value={s.key}>{s.title}</option>)}</select></Field>}
      </> : <Field label="本次学习内容"><input maxLength={200} disabled={busy} className={inputClass} value={title} onChange={e=>{setTitle(e.target.value);setChanged(true)}} /></Field>}
      <p className="text-xs text-slate-500">更换内容会重算未完成任务；已完成任务保留原记录。下一次进度请在课程编辑器中修改。</p>
      <div className="flex flex-wrap gap-2">{event?.completion_state !== 'completed' && <button className={buttonClass} disabled={busy || event?.assignment_state === 'cancelled'} onClick={()=>void run(()=>action(true))}>完课并生成任务</button>}{event && <button className={minorClass} disabled={busy || !changed} onClick={()=>void run(()=>action(false))}>保存本次内容</button>}<button className={minorClass} disabled={busy} onClick={onClose}>关闭</button></div>
    </div>
  </Panel>
}
