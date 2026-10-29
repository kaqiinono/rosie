'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TaskInstance, Subject } from '../types'
import { SUBJECTS } from '../types'
import { localDate, displayTime, atTime } from '../time'
import TaskAudio from './TaskAudio'
import TodayCourseSummary from './TodayCourseSummary'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, SubjectSelect, lines, text, safeHref } from './shared'

function TaskCard({ task, audio, onAudio }: { task: TaskInstance; audio: boolean; onAudio: () => void }) {
  const { api, run, busy } = useTasks()
  const material = api.data.materials.find(m => m.course_id === task.course_id && m.lesson_key === task.lesson?.key && m.kind === task.material_kind)
  const href = safeHref(material?.href ?? task.lesson?.href)
  const missing = task.mode === 'audio' ? !material?.audio.length : task.mode === 'reading' ? !href : false
  const overdue = !!task.due_at && +new Date(task.due_at) < Date.now() && ['pending', 'active'].includes(task.status)
  return <article id={`task-${task.id}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-slate-800">{task.title}</h3><span className={overdue ? 'text-sm font-bold text-rose-700' : 'text-sm text-slate-500'}>{task.status === 'completed' ? '已完成' : task.status === 'cancelled' ? '已取消' : overdue ? '已逾期' : task.status === 'active' ? '进行中' : '未开始'}</span></div>
    <p className="text-sm text-slate-500">{task.subject ? SUBJECTS[task.subject] : '自定义'} · {task.due_at ? `截止 ${displayTime(task.due_at)}` : task.due_kind === 'next_class' ? '待安排下次课后确定截止时间' : '未设置截止时间'}</p>
    {missing && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">待准备资料 · 请在学习资料中关联{task.mode === 'audio' ? '多段音频' : '阅读链接'}</p>}
    {task.selection_state === 'pending' && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">待选题 · 选择实际题目后记录完成进度，预计用时已保留。</p>}
    <ul className="space-y-2">{task.items.map(item => <li key={item.id} className="flex items-start gap-2 text-sm"><input aria-label={item.label} type="checkbox" className="mt-1" checked={item.done} disabled={busy || task.status === 'cancelled'} onChange={e => { const items = task.items.map(i => i.id === item.id ? { ...i, done: e.target.checked } : i); void run(async () => { await api.save('tasks', { id: task.id, items, status: items.every(i => i.done) ? 'completed' : 'active' }); await api.refresh() }) }} /><span className={item.done ? 'text-slate-400 line-through' : ''}>{item.label}</span>{safeHref(item.href) && <Link className="text-indigo-700 underline" href={safeHref(item.href)!}>查看题目</Link>}</li>)}</ul>
    {['pending', 'active'].includes(task.status) && <>
      <div className="flex flex-wrap gap-2">{task.mode === 'reading' && href && <Link className={minorClass} href={href}>进入阅读</Link>}{task.mode === 'audio' && material?.audio.length ? <button className={minorClass} onClick={onAudio}>{audio ? '收起播放器' : '听记 / 背诵'}</button> : null}
        <button disabled={busy} className={minorClass} onClick={() => void run(() => api.save('tasks', { id: task.id, status: 'active' }))}>开始任务</button>
        <button disabled={busy || task.selection_state === 'pending' || task.items.some(i => !i.done)} className={buttonClass} onClick={() => void run(async () => { await api.save('tasks', { id: task.id, status: 'completed' }); await api.refresh() })}>确认完成</button>
        <button disabled={busy} className={minorClass} onClick={() => void run(async () => { await api.save('tasks', { id: task.id, status: 'cancelled' }); await api.refresh() })}>取消任务</button>
      </div>
      <details><summary className="cursor-pointer text-sm text-slate-500">调整预计时长与截止时间</summary><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const due = text(f, 'due'); await api.save('tasks', { id: task.id, estimated_minutes: Number(text(f, 'minutes')), ...(due ? { due_at: new Date(`${due}+08:00`).toISOString(), due_kind: 'fixed', due_occurrence_id: null } : {}) }); await api.refresh() }) }}><Field label="预计分钟"><input required type="number" name="minutes" min={1} max={1440} defaultValue={task.estimated_minutes} className={inputClass} /></Field><Field label="新截止时间（留空保留现有规则）"><input type="datetime-local" name="due" className={inputClass} /></Field><button disabled={busy} className={minorClass}>保存调整</button></form></details>
    </>}
    {audio && material && <TaskAudio key={material.id} material={material} />}
  </article>
}

export default function TaskList() {
  const { api, run, busy } = useTasks()
  const [subject, setSubject] = useState<Subject | ''>('')
  const [history, setHistory] = useState(false)
  const [todayOnly, setTodayOnly] = useState(false)
  const [audioId, setAudioId] = useState('')
  const [courseFilter, setCourseFilter] = useState(''), [taskFilter, setTaskFilter] = useState('')
  useEffect(() => { const params = new URLSearchParams(window.location.search); setCourseFilter(params.get('course') ?? ''); setTaskFilter(params.get('task') ?? ''); if (params.has('task')) setHistory(true) }, [])
  const tasks = api.data.tasks.filter(t => (!courseFilter || t.course_id === courseFilter) && (!taskFilter || t.id === taskFilter) && (!subject || t.subject === subject) && (history ? true : ['pending', 'active'].includes(t.status)) && (!todayOnly || !t.due_at || localDate(new Date(t.due_at)) <= localDate() || localDate(new Date(t.created_at)) === localDate() || api.data.blocks.some(b => b.task_id === t.id && localDate(new Date(b.starts_at)) === localDate()))).sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
  const reminders = api.data.reminders.filter(r => !r.source_key.startsWith('confirm:') && !r.read_at && r.status !== 'cancelled' && +new Date(r.remind_at) <= Date.now() && (!r.expires_at || +new Date(r.expires_at) > Date.now()) && (!r.task_id || api.data.tasks.some(t => t.id === r.task_id && ['pending', 'active'].includes(t.status))) && (!r.exam_id || api.data.exams.some(exam => exam.id === r.exam_id && +new Date(exam.ends_at) > Date.now())) && (r.task_id || !r.occurrence_id || api.data.occurrences.some(o => o.id === r.occurrence_id && o.status === 'scheduled')))
  const courseName = (id: string) => api.data.courses.find(c => c.id === id)?.name ?? '课程'
  const reminderHref = (reminder: typeof reminders[number]) => {
    if (reminder.task_id) return `#task-${reminder.task_id}`
    const exam = api.data.exams.find(item => item.id === reminder.exam_id)
    if (exam) return `/tasks/timetable?date=${localDate(new Date(exam.starts_at))}`
    const occurrence = api.data.occurrences.find(item => item.id === reminder.occurrence_id)
    if (occurrence && +new Date(occurrence.ends_at) > Date.now()) return `/tasks/timetable?date=${localDate(new Date(occurrence.starts_at))}&course=${encodeURIComponent(occurrence.course_id)}`
    return '/tasks/timetable'
  }
  return <div className="space-y-5">
    <TodayCourseSummary />
    {(courseFilter || taskFilter) && <div className="flex items-center gap-3 text-sm text-emerald-900"><span>正在查看{courseFilter ? courseName(courseFilter) : '指定'}的关联任务</span><button className={minorClass} onClick={() => { setCourseFilter(''); setTaskFilter('') }}>查看全部任务</button></div>}
    {reminders.length > 0 && <Panel title="现在需要留意"><div className="space-y-3">{reminders.map(r => <div key={r.id} className="flex items-center justify-between gap-3 text-sm"><Link href={reminderHref(r)} className="text-emerald-800 hover:underline">{r.title} · {displayTime(r.remind_at)}</Link><button disabled={busy} className={minorClass} onClick={() => void run(() => api.save('reminders', { id: r.id, read_at: new Date().toISOString() }))}>已读</button></div>)}</div></Panel>}
    <Panel title="我的任务"><div className="flex flex-wrap items-center gap-3"><SubjectSelect all value={subject} onChange={setSubject} /><label className="whitespace-nowrap text-sm"><input type="checkbox" checked={todayOnly} onChange={e => setTodayOnly(e.target.checked)} /> 今日、逾期及今日新任务</label><label className="whitespace-nowrap text-sm"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} /> 包含完成与取消</label></div><p className="text-sm text-slate-500">未完成任务持续保留；取消今日筛选查看全部任务。点击时间安排，为作业选择可用时段。</p></Panel>
    {!tasks.length && <p className="p-4 text-sm text-slate-500">暂无任务。绑定课程活动后按课程设置自动分配，也可在课程详情手动完课或创建自定义任务。</p>}
    {tasks.map(t => <TaskCard key={t.id} task={t} audio={t.id === audioId && ['pending', 'active'].includes(t.status)} onAudio={() => setAudioId(p => p === t.id ? '' : t.id)} />)}
    <Panel title="添加一次性自定义任务"><form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run(async () => { const date = text(f, 'date'); const due = date ? atTime(date, text(f, 'time')) : null; const task = await api.save('tasks', { title: text(f, 'title'), source_key: `custom:${crypto.randomUUID()}`, subject: (text(f, 'subject') || null) as Subject | null, mode: 'checklist', status: 'pending', due_at: due, due_kind: 'fixed', estimated_minutes: Number(text(f, 'minutes')), items: lines(text(f, 'items')).map((label, i) => ({ id: String(i), label, done: false })) }); if (due && f.get('remind') === 'on') await api.save('reminders', { task_id: task.id, source_key: `custom:${task.id}`, title: task.title, remind_at: new Date(+new Date(due) - Number(text(f, 'reminder_minutes')) * 60000).toISOString() }); form.reset() }) }}>
      <Field label="名称"><input required name="title" maxLength={120} className={inputClass} /></Field><Field label="科目"><select name="subject" className={inputClass}><option value="">自定义</option>{Object.entries(SUBJECTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="清单（每行一项）"><textarea name="items" className={inputClass} /></Field><Field label="预计分钟"><input required type="number" min={1} max={1440} name="minutes" defaultValue={20} className={inputClass} /></Field>
      <Field label="截止日期（可选）"><input type="date" name="date" defaultValue={localDate()} className={inputClass} /></Field><Field label="截止时间"><input required type="time" name="time" defaultValue="20:30" className={inputClass} /></Field>
      <label className="text-sm"><input type="checkbox" name="remind" defaultChecked /> 截止前提醒</label><Field label="提前分钟"><input type="number" required min={0} max={525600} name="reminder_minutes" defaultValue={60} className={inputClass} /></Field><button disabled={busy} className={buttonClass}>创建任务</button>
    </form></Panel>
  </div>
}
