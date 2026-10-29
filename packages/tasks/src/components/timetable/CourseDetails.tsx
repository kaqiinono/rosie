'use client'

import { useState } from 'react'
import { saveCourseWithCatchup } from '../../courseEvents'
import type { CourseEvent } from '../../courseTypes'
import type { TaskCourse, TimetableOccurrence } from '../../types'
import { atTime, displayTime, localDate } from '../../time'
import { recurrenceLabel } from '../../timetable'
import { TasksContext, useTasks, minorClass, buttonClass, inputClass, Field, weekdays, safeHref } from '../shared'
import CourseConfirm from '../CourseConfirm'
import TimetableDialog from './TimetableDialog'
import { clockTime, statusLabel, courseColor } from './presentation'

export default function CourseDetails({ course, occurrence, onClose, onEdit, onSelectOccurrence, initialAction = 'detail' }: { initialAction?: 'detail' | 'archive'; course: TaskCourse; occurrence?: TimetableOccurrence; onClose: () => void; onEdit: (duplicate?: boolean) => void; onSelectOccurrence: (row: TimetableOccurrence) => void }) {
  const [makeupRequest] = useState(() => crypto.randomUUID())
  const context = useTasks()
  const { api, notify } = context
  const [historyLimit, setHistoryLimit] = useState(20)
  const [action, setAction] = useState<'detail' | 'adjust' | 'archive' | 'confirm'>(initialAction)
  const [date, setDate] = useState(occurrence ? localDate(new Date(occurrence.starts_at)) : localDate())
  const [endDate, setEndDate] = useState(occurrence ? localDate(new Date(occurrence.ends_at)) : localDate())
  const [start, setStart] = useState(occurrence ? clockTime(occurrence.starts_at) : '16:00')
  const [end, setEnd] = useState(occurrence ? clockTime(occurrence.ends_at) : '17:00')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false)
  const rules = api.data.course_rules.filter(rule => rule.course_id === course.id)
  const events = api.data.events.filter(e => e.course_id === course.id).sort((a, b) => b.release_at.localeCompare(a.release_at) || b.id.localeCompare(a.id))
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const currentEvent = events.find(e => e.id === selectedEvent) ?? events.find(e => e.occurrence_id === occurrence?.id) ?? events.find(e => e.on_date === localDate()) ?? events[0]
  const snapshot = api.data.catalog_snapshots.find(s => s.id === course.catalog_snapshot_id)
  const nextLesson = snapshot?.ordered_lessons.find(l => l.key === course.cursor?.lesson_key)
  const nextSegment = snapshot?.teaching_segments.find(s => s.key === course.cursor?.segment_key)
  const eventContent = (event: CourseEvent) => {
    const saved = event.lesson_snapshot
    if (!saved?.lesson) return '尚未设置内容'
    // Legacy events omit subject; match their immutable lesson identity, never mutable course metadata.
    const candidates = api.data.catalog_snapshots.filter(s => s.user_id === event.user_id && s.version === saved.catalog_version && s.ordered_lessons.some(l => l.key === saved.lesson?.key && l.book === saved.lesson.book && l.unit === saved.lesson.unit && l.title === saved.lesson.title && l.kind === saved.lesson.kind))
    const catalog = candidates.length === 1 ? candidates[0] : undefined
    const segment = catalog?.teaching_segments.find(s => s.key === saved.cursor?.segment_key && s.lesson_key === saved.lesson?.key)
    return [saved.lesson.book, saved.lesson.unit, saved.lesson.title, saved.segment_title ?? segment?.title ?? (saved.cursor?.segment_key ? '教学段历史详情不可用' : null)].filter(Boolean).join(' · ')
  }
  const materials = api.data.materials.filter(material => material.course_id === course.id)
  const tasks = api.data.tasks.filter(task => task.course_id === course.id && (!occurrence || task.occurrence_id === occurrence.id))
  const exams = api.data.exams.filter(exam => exam.course_id === course.id)
  const exception = occurrence && api.data.exceptions.find(item => item.rule_id === occurrence.rule_id && item.original_date === occurrence.original_date)
  const confirmed = api.data.occurrences.filter(item => item.course_id === course.id && item.confirmation).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const close = () => { if (busy || context.busy) return; if (action === 'adjust') setDiscard(true); else onClose() }
  const mutate = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { await work(); await api.refresh(); notify(message); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。') } finally { setBusy(false) }
  }
  return <TimetableDialog title={course.name} onClose={close} description={occurrence ? `${displayTime(occurrence.starts_at)}–${clockTime(occurrence.ends_at)} · ${statusLabel[occurrence.status]}` : '课程资料、排课与学习记录'}>
    {error && <p id="course-detail-error" role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {action === 'confirm' && (currentEvent || occurrence) ? <TasksContext.Provider value={{ ...context, run: work => context.run(async () => { setError(''); try { await work() } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。'); throw cause } }) }}><CourseConfirm key={currentEvent?.id ?? occurrence?.id} event={currentEvent} occurrence={occurrence} onClose={() => setAction('detail')} /></TasksContext.Provider> : action === 'adjust' && occurrence ? <form noValidate onInput={e => { const field = e.target; if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby') } }} className="space-y-4" onSubmit={e => { e.preventDefault(); if (!e.currentTarget.checkValidity()) { const invalid = e.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid'); invalid?.setAttribute('aria-invalid', 'true'); invalid?.setAttribute('aria-describedby', 'course-detail-error'); invalid?.focus(); setError('请填写有效的日期和时间。'); return } if (!date || !endDate || +new Date(atTime(date, start)) >= +new Date(atTime(endDate, end))) { setError('结束时间需晚于开始时间。'); return } void mutate(() => api.save('exceptions', { id: exception?.id, rule_id: occurrence.rule_id, original_date: occurrence.original_date, cancelled: false, starts_at: atTime(date, start), ends_at: atTime(endDate, end) }), '本次课程已调整') }}>
      <p className="text-sm text-slate-600">只修改原定 {occurrence.original_date} 的这一课次；关联的相对截止任务随之调整。</p>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><Field label="改至日期"><input required type="date" value={date} onChange={e => { if (endDate === date) setEndDate(e.target.value); setDate(e.target.value) }} className={inputClass} /></Field><Field label="开始时间"><input required type="time" value={start} onChange={e => setStart(e.target.value)} className={inputClass} /></Field><Field label="结束日期"><input required type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className={inputClass} /></Field><Field label="结束时间"><input required type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} /></Field></fieldset>
      <div className="flex gap-2"><button disabled={busy} className={buttonClass}>保存本次调整</button><button type="button" className={minorClass} disabled={busy} onClick={() => setDiscard(true)}>返回</button></div>
      {discard && <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm"><p>放弃尚未保存的本次调整？</p><button type="button" className={minorClass} onClick={() => { setAction('detail'); setDiscard(false) }}>放弃调整</button> <button type="button" className={minorClass} onClick={() => setDiscard(false)}>继续编辑</button></div>}
    </form> : action === 'archive' ? <div className="space-y-4"><p className="text-sm">归档后将停止未来排课和课程提醒，已有任务、确认与学习资料仍会保留。</p><div className="flex gap-3"><button disabled={busy} className={buttonClass} onClick={() => void mutate(() => api.archiveCourse(course.id), '课程已归档')}>确认归档</button><button disabled={busy} className={minorClass} onClick={() => setAction('detail')}>取消</button></div></div> : <div className="space-y-6">
      <div className="rounded-lg px-4 py-3 font-semibold" style={{ backgroundColor: courseColor(course).background, color: courseColor(course).text }}>{course.name} · {courseColor(course).label}</div>
      <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">{[['教师', course.teacher || '未填写'], ['地点', course.location || '未填写'], ['课表', api.data.calendars.find(c => c.id === course.calendar_id)?.name || '未分组']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}{course.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">备注</dt><dd className="mt-1 whitespace-pre-wrap break-words">{course.notes}</dd></div>}</dl>
      <div className="flex flex-wrap gap-2">
        {!course.archived_at && <button className={buttonClass} onClick={() => onEdit()}>编辑课程 / 后续排课</button>}
        <button className={minorClass} onClick={() => onEdit(true)}>复制课程</button>
        {course.archived_at ? <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.rpc('task_restore_course', { p_course: course.id }), '课程已恢复')}>恢复归档课程</button> : <button className={minorClass} onClick={() => setAction('archive')}>归档课程</button>}
      </div>
      <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-bold">本次与下一次内容</h3>
        {course.generation_state === 'paused' && <p role="status" className="text-sm text-amber-800">教学段配置不足，自动推进已暂停。编辑课程补齐后从当前日期继续。</p>}
        {course.generation_state === 'finished' && <p className="text-sm text-emerald-800">已到目录末尾。需要继续学习时，请编辑下一次内容。</p>}
        {!course.archived_at && <div className="flex flex-wrap gap-2">{currentEvent && currentEvent.assignment_state !== 'cancelled' && <button className={buttonClass} onClick={()=>setAction('confirm')}>手动完课 / 修改本次内容</button>}{currentEvent && currentEvent.completion_state !== 'completed' && currentEvent.assignment_state !== 'cancelled' && <button className={minorClass} disabled={busy} onClick={()=>void mutate(()=>api.rpc('task_cancel_event',{p_event_id:currentEvent.id,p_expected_revision:currentEvent.revision}),'本次已停课')}>取消本次学习</button>}<button className={minorClass} disabled={busy} onClick={()=>void mutate(()=>saveCourseWithCatchup(async()=>await api.rpc('task_makeup_event',{p_course_id:course.id,p_request_id:makeupRequest,p_on_date:localDate()}) as string | null,api.refresh),'已添加今天的补课事件，请在详情中完课')}>添加今天补课</button></div>}
        <p className="text-sm text-slate-600">自动分配：{course.auto_assign ? '开启' : '关闭'} · 自动推进：{course.auto_advance ? '开启' : '关闭'}</p>
        {course.effective_from && course.effective_from > localDate() && <p className="text-sm text-amber-800">{course.effective_from} 起使用{course.course_type === 'flexible' ? '自由课程' : '课表课程'}规则；此前按各自的原排课时间上课。</p>}
        {events.length > 1 && <Field label="选择学习事件"><select className={inputClass} value={currentEvent?.id ?? ''} onChange={e => setSelectedEvent(e.target.value)}>{events.map(e => <option key={e.id} value={e.id}>{e.on_date} {e.starts_at ? clockTime(e.starts_at) : '自由课程'} · {eventContent(e)}</option>)}</select></Field>}
        {currentEvent ? <div className="space-y-1 text-sm"><p>本次：{eventContent(currentEvent)}</p><p>{currentEvent.assignment_state === 'assigned' ? '已分配任务' : currentEvent.assignment_state === 'cancelled' ? '已取消' : '尚未分配任务'} · {currentEvent.completion_state === 'completed' ? '已完课' : '尚未完课'}</p></div> : <p className="text-sm text-slate-500">尚无学习事件。</p>}
        <p className="text-sm">下一次：{nextLesson ? `${nextLesson.book} · ${nextLesson.unit} · ${nextLesson.title}${nextSegment ? ` · ${nextSegment.title}` : ''}` : '未设置'}</p>
        {snapshot?.progression_mode === 'segment' && course.cursor && !nextSegment && <p className="text-sm text-amber-800">下一教学段尚未配置，请编辑课程补齐后继续。</p>}
        <p className="text-xs text-slate-500">分配任务与实际完课分别记录。编辑下一次内容不会改写本次或已完成历史。</p>
      </section>
      {occurrence && <section className="space-y-3 border-t border-slate-200 pt-4"><h3 className="font-bold">本次课程</h3>{+new Date(occurrence.ends_at) <= Date.now() && <p className="text-sm text-slate-500">本次已经结束，历史上课时间保留。后续排课可通过编辑课程调整。</p>}{occurrence.confirmation && <div className="rounded-xl bg-emerald-50 p-3 text-sm"><p>已讲：{occurrence.confirmation.lesson.title}</p><p>下次预备：{occurrence.confirmation.next_lesson?.title ?? '未设置'}</p>{[...occurrence.confirmation.class_items, ...occurrence.confirmation.homework_items].map(item => <p key={item.id} className="mt-1">{item.label}</p>)}</div>}
        <div className="flex flex-wrap gap-2">{!occurrence.preview && occurrence.status !== 'cancelled' && <button className={buttonClass} onClick={() => setAction('confirm')}>{occurrence.status === 'confirmed' ? '查看 / 修改本次内容' : '完课并生成任务'}</button>}{occurrence.preview && <p className="w-full text-sm text-slate-500">这是未来排课预览；课次生成后可手动完课。</p>}{occurrence.status !== 'confirmed' && !course.archived_at && +new Date(occurrence.ends_at) > Date.now() && <><button className={minorClass} onClick={() => setAction('adjust')}>仅调整本次</button>{occurrence.status !== 'cancelled' && <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.save('exceptions', { id: exception?.id, rule_id: occurrence.rule_id, original_date: occurrence.original_date, cancelled: true, starts_at: null, ends_at: null }), '本次已停课')}>本次停课</button>}{exception && <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.remove('exceptions', exception.id), '本次已恢复原排课')}>恢复原排课</button>}</>}</div>
      </section>}
      <section className="space-y-2"><h3 className="font-bold">全部排课</h3>{rules.length ? rules.map(rule => <div key={rule.id} className="border-b border-slate-100 py-2 text-sm"><p>{weekdays[rule.weekday]} {rule.kind === 'flexible' ? '自由课程（无固定时刻）' : `${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)}`} · {recurrenceLabel(rule)}</p><p className="mt-1 text-xs text-slate-500">{rule.valid_from} 至 {rule.valid_until ?? '持续'}{rule.disabled_from && ` · ${rule.disabled_from} 起已停用`}</p></div>) : <p className="text-sm text-slate-500">暂无排课</p>}</section>
      <section className="space-y-2"><div className="flex justify-between"><h3 className="font-bold">关联任务 · {tasks.length}</h3><a className="text-sm font-semibold text-emerald-800 underline" href={`/tasks?course=${course.id}`}>查看任务</a></div>{tasks.map(task => <a key={task.id} href={`/tasks?course=${course.id}&task=${task.id}`} className="block rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">{task.title}<span className="ml-2 text-xs text-slate-500">{task.status === 'completed' ? '已完成' : task.status === 'cancelled' ? '已取消' : '待完成'}{task.due_at && ` · ${displayTime(task.due_at)}截止`}</span></a>)}{!tasks.length && <p className="text-sm text-slate-500">暂无关联任务。</p>}</section>
      <section className="space-y-2"><div className="flex justify-between"><h3 className="font-bold">学习资料 · {materials.length}</h3><a className="text-sm font-semibold text-emerald-800 underline" href={`/tasks/materials?course=${course.id}`}>管理资料</a></div>{materials.map(material => <div key={material.id} className="text-sm">{safeHref(material.href) ? <a href={safeHref(material.href)!} className="text-emerald-800 underline">{material.title}</a> : <span>{material.title}</span>}{material.audio.length > 0 && <span className="ml-2 text-xs text-slate-500">{material.audio.length} 段录音 · 在资料页播放</span>}</div>)}</section>
      <section className="space-y-2"><h3 className="font-bold">考试 · {exams.length}</h3>{exams.map(exam => <p key={exam.id} className="text-sm">{exam.title} · {displayTime(exam.starts_at)} {exam.location}</p>)}</section>
      <section className="space-y-2"><h3 className="font-bold">确认记录 · {confirmed.length}</h3>{confirmed.slice(0, historyLimit).map(row => <button key={row.id} className="block text-left text-sm text-emerald-800 underline" onClick={() => onSelectOccurrence({ ...row, preview: false })}>{displayTime(row.starts_at)} · {row.confirmation?.lesson.title} →</button>)}{confirmed.length > historyLimit && <button className={minorClass} onClick={() => setHistoryLimit(limit => limit + 20)}>加载更早记录</button>}</section>
    </div>}
  </TimetableDialog>
}
