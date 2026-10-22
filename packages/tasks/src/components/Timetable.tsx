'use client'

import { useState, type FormEvent } from 'react'
import type { CourseOccurrence, Subject, TimetableRule } from '../types'
import { localDate, dateAfter, displayTime, atTime } from '../time'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, CourseSelect, SubjectSelect, WeekdaySelect, weekdays, text } from './shared'

export default function Timetable() {
  const { api, run, busy } = useTasks()
  const [course, setCourse] = useState('')
  const [subject, setSubject] = useState<Subject | ''>('chinese')
  const [week, setWeek] = useState(() => dateAfter(localDate(), -((new Date(atTime(localDate(), '12:00')).getUTCDay() + 6) % 7)))
  const [editing, setEditing] = useState<TimetableRule | null>(null)
  const [exception, setException] = useState<CourseOccurrence | null>(null)
  async function saveRule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const ok = await run(async () => {
      if (editing) await api.rpc('task_replace_rule', { p_rule: editing.id, p_from: text(f, 'date'), p_weekday: Number(text(f, 'weekday')), p_start: text(f, 'start'), p_end: text(f, 'end'), p_until: text(f, 'until') || null })
      else { await api.save('rules', { course_id: course, weekday: Number(text(f, 'weekday')), start_time: text(f, 'start'), end_time: text(f, 'end'), valid_from: text(f, 'date'), valid_until: text(f, 'until') || null }); await api.refresh() }
    })
    if (ok) setEditing(null)
  }
  const courseName = (id: string) => api.data.courses.find(c => c.id === id)?.name ?? '课程'
  const shown = api.data.occurrences.filter(o => { const date = localDate(new Date(o.starts_at)); return date >= week && date < dateAfter(week, 7) }).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return <div className="space-y-5">
    <Panel title="课程"><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run(async () => { await api.save('courses', { name: text(f, 'name'), subject: subject as Subject }); form.reset() }) }}>
      <Field label="课程名称"><input required name="name" maxLength={120} className={inputClass} placeholder="例如：学校语文" /></Field>
      <Field label="科目"><SubjectSelect value={subject} onChange={setSubject} /></Field><button disabled={busy} className={buttonClass}>添加课程</button>
    </form><p className="text-sm text-slate-500">同一课程的多个上课时段共享进度及下次课截止规则。</p></Panel>
    <Panel title={editing ? '调整后续每周课程' : '添加每周时段'}><form key={editing?.id ?? 'new'} className="grid gap-3 sm:grid-cols-3" onSubmit={saveRule}>
      <Field label="课程">{editing ? <span>{courseName(editing.course_id)}</span> : <CourseSelect value={course} onChange={setCourse} />}</Field>
      <Field label="星期"><WeekdaySelect value={editing?.weekday} /></Field>
      <Field label="生效日期"><input required type="date" name="date" min={editing ? localDate() : undefined} defaultValue={editing ? localDate() : localDate()} className={inputClass} /></Field>
      <Field label="开始时间"><input required type="time" name="start" defaultValue={editing?.start_time.slice(0, 5) ?? '16:00'} className={inputClass} /></Field>
      <Field label="结束时间"><input required type="time" name="end" defaultValue={editing?.end_time.slice(0, 5) ?? '17:00'} className={inputClass} /></Field>
      <Field label="结束日期（可选，留空持续循环）"><input type="date" name="until" defaultValue={editing?.valid_until ?? ''} className={inputClass} /></Field>
      <div className="flex gap-2"><button disabled={busy} className={buttonClass}>保存</button>{editing && <button type="button" className={minorClass} onClick={() => setEditing(null)}>取消编辑</button>}</div>
    </form>
    {api.data.rules.filter(r => !r.valid_until || r.valid_until >= localDate()).map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm"><span>{courseName(r.course_id)} · {weekdays[r.weekday]} {r.start_time.slice(0, 5)}—{r.end_time.slice(0, 5)} · {r.valid_from} 起</span><button className={minorClass} onClick={() => setEditing(r)}>调整后续</button></div>)}
    </Panel>
    <Panel title="七日课表"><Field label="查看起始日期"><input type="date" value={week} onChange={e => setWeek(e.target.value || localDate())} className={inputClass} /></Field>
      {!shown.length && <p className="text-sm text-slate-500">暂无课程，课表滚动生成未来五周。</p>}
      {shown.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3"><div><strong>{courseName(o.course_id)}</strong><p className="text-sm text-slate-500">{displayTime(o.starts_at)}—{displayTime(o.ends_at)} · {o.status === 'confirmed' ? '已确认' : o.status === 'cancelled' ? '已停课' : '待上课/确认'}</p></div>{o.status !== 'confirmed' && <button className={minorClass} onClick={() => setException(o)}>本次停课 / 调课</button>}</div>)}
      {exception && <form key={exception.id} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const existing = api.data.exceptions.find(x => x.rule_id === exception.rule_id && x.original_date === exception.original_date); const cancelled = f.get('cancelled') === 'on'; await api.save('exceptions', { id: existing?.id, rule_id: exception.rule_id, original_date: exception.original_date, cancelled, starts_at: cancelled ? null : atTime(text(f, 'date'), text(f, 'start')), ends_at: cancelled ? null : atTime(text(f, 'date'), text(f, 'end')) }); await api.refresh(); setException(null) }) }}>
        <strong className="sm:col-span-2">仅修改 {exception.original_date} 的 {courseName(exception.course_id)}</strong>
        <label><input type="checkbox" name="cancelled" /> 本次停课</label><Field label="改至日期"><input required type="date" name="date" defaultValue={localDate(new Date(exception.starts_at))} className={inputClass} /></Field>
        <Field label="开始"><input required type="time" name="start" defaultValue={new Date(exception.starts_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })} className={inputClass} /></Field>
        <Field label="结束"><input required type="time" name="end" defaultValue={new Date(exception.ends_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })} className={inputClass} /></Field>
        <button disabled={busy} className={buttonClass}>保存本次调整</button><button type="button" className={minorClass} onClick={() => setException(null)}>取消</button>
      </form>}
    </Panel>
  </div>
}
