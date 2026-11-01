'use client'

import { useState } from 'react'
import type { TimetableCourse, TimetableOccurrence } from '../../types'
import { atTime, displayTime, localDate } from '../../time'
import { recurrenceLabel } from '../../timetable'
import { useTimetable, minorClass, buttonClass, inputClass, Field, weekdays } from '../shared'
import TimetableDialog from './TimetableDialog'
import { clockTime, statusLabel, courseColor } from './presentation'

export default function CourseDetails({ course, occurrence, onClose, onEdit, initialAction = 'detail' }: { initialAction?: 'detail' | 'archive'; course: TimetableCourse; occurrence?: TimetableOccurrence; onClose: () => void; onEdit: (duplicate?: boolean) => void }) {
  const { api, notify } = useTimetable()
  const [action, setAction] = useState<'detail' | 'adjust' | 'archive'>(initialAction)
  const [date, setDate] = useState(occurrence ? localDate(new Date(occurrence.starts_at)) : localDate())
  const [endDate, setEndDate] = useState(occurrence ? localDate(new Date(occurrence.ends_at)) : localDate())
  const [start, setStart] = useState(occurrence ? clockTime(occurrence.starts_at) : '16:00')
  const [end, setEnd] = useState(occurrence ? clockTime(occurrence.ends_at) : '17:00')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false)
  const rules = api.data.rules.filter(rule => rule.course_id === course.id)
  const exception = occurrence && api.data.exceptions.find(item => item.rule_id === occurrence.rule_id && item.original_date === occurrence.original_date)
  const close = () => { if (busy) return; if (action === 'adjust') setDiscard(true); else onClose() }
  const mutate = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { await work(); notify(message); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。') } finally { setBusy(false) }
  }
  return <TimetableDialog title={course.name} onClose={close} description={occurrence ? `${displayTime(occurrence.starts_at)}–${clockTime(occurrence.ends_at)} · ${statusLabel[occurrence.status]}` : '课程资料与排课'}>
    {error && <p id="course-detail-error" role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {action === 'adjust' && occurrence ? <form noValidate onInput={e => { const field = e.target; if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby') } }} className="space-y-4" onSubmit={e => { e.preventDefault(); if (!e.currentTarget.checkValidity()) { const invalid = e.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid'); invalid?.setAttribute('aria-invalid', 'true'); invalid?.setAttribute('aria-describedby', 'course-detail-error'); invalid?.focus(); setError('请填写有效的日期和时间。'); return } if (!date || !endDate || +new Date(atTime(date, start)) >= +new Date(atTime(endDate, end))) { setError('结束时间需晚于开始时间。'); return } void mutate(() => api.save('exceptions', { id: exception?.id, rule_id: occurrence.rule_id, original_date: occurrence.original_date, cancelled: false, starts_at: atTime(date, start), ends_at: atTime(endDate, end) }), '本次课程已调整') }}>
      <p className="text-sm text-slate-600">只修改原定 {occurrence.original_date} 的这一课次。</p>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><Field label="改至日期"><input required type="date" value={date} onChange={e => { if (endDate === date) setEndDate(e.target.value); setDate(e.target.value) }} className={inputClass} /></Field><Field label="开始时间"><input required type="time" value={start} onChange={e => setStart(e.target.value)} className={inputClass} /></Field><Field label="结束日期"><input required type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className={inputClass} /></Field><Field label="结束时间"><input required type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} /></Field></fieldset>
      <div className="flex gap-2"><button disabled={busy} className={buttonClass}>保存本次调整</button><button type="button" className={minorClass} disabled={busy} onClick={() => setDiscard(true)}>返回</button></div>
      {discard && <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm"><p>放弃尚未保存的本次调整？</p><button type="button" className={minorClass} onClick={() => { setAction('detail'); setDiscard(false) }}>放弃调整</button> <button type="button" className={minorClass} onClick={() => setDiscard(false)}>继续编辑</button></div>}
    </form> : action === 'archive' ? <div className="space-y-4"><p className="text-sm">归档后将停止未来排课和课程提醒。</p><div className="flex gap-3"><button disabled={busy} className={buttonClass} onClick={() => void mutate(() => api.setArchived(course, true), '课程已归档')}>确认归档</button><button disabled={busy} className={minorClass} onClick={() => setAction('detail')}>取消</button></div></div> : <div className="space-y-6">
      <div className="rounded-lg px-4 py-3 font-semibold" style={{ backgroundColor: courseColor(course).background, color: courseColor(course).text }}>{course.name} · {courseColor(course).label}</div>
      <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">{[['教师', course.teacher || '未填写'], ['地点', course.location || '未填写'], ['课表', api.data.calendars.find(c => c.id === course.calendar_id)?.name || '未分组']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}{course.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">备注</dt><dd className="mt-1 whitespace-pre-wrap break-words">{course.notes}</dd></div>}</dl>
      <div className="flex flex-wrap gap-2">
        {!course.archived_at && <button className={buttonClass} onClick={() => onEdit()}>编辑课程 / 后续排课</button>}
        <button className={minorClass} onClick={() => onEdit(true)}>复制课程</button>
        {course.archived_at ? <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.setArchived(course, false), '课程已恢复')}>恢复归档课程</button> : <button className={minorClass} onClick={() => setAction('archive')}>归档课程</button>}
      </div>
        {course.effective_from && course.effective_from > localDate() && <p className="text-sm text-amber-800">{course.effective_from} 起使用{course.course_type === 'flexible' ? '自由课程' : '课表课程'}规则；此前按各自的原排课时间上课。</p>}
      {occurrence && <section className="space-y-3 border-t border-slate-200 pt-4"><h3 className="font-bold">本次课程</h3>{+new Date(occurrence.ends_at) <= Date.now() && <p className="text-sm text-slate-500">本次已经结束，历史上课时间保留。后续排课可通过编辑课程调整。</p>}
        <div className="flex flex-wrap gap-2">{!course.archived_at && +new Date(occurrence.ends_at) > Date.now() && <><button className={minorClass} onClick={() => setAction('adjust')}>仅调整本次</button>{occurrence.status !== 'cancelled' && <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.save('exceptions', { id: exception?.id, rule_id: occurrence.rule_id, original_date: occurrence.original_date, cancelled: true, starts_at: null, ends_at: null }), '本次已停课')}>本次停课</button>}{exception && <button className={minorClass} disabled={busy} onClick={() => void mutate(() => api.removeException(exception.id), '本次已恢复原排课')}>恢复原排课</button>}</>}</div>
      </section>}
      <section className="space-y-2"><h3 className="font-bold">全部排课</h3>{rules.length ? rules.map(rule => <div key={rule.id} className="border-b border-slate-100 py-2 text-sm"><p>{weekdays[rule.weekday]} {rule.kind === 'flexible' ? '自由课程（无固定时刻）' : `${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)}`} · {recurrenceLabel(rule)}</p><p className="mt-1 text-xs text-slate-500">{rule.valid_from} 至 {rule.valid_until ?? '持续'}{rule.disabled_from && ` · ${rule.disabled_from} 起已停用`}</p></div>) : <p className="text-sm text-slate-500">暂无排课</p>}</section>
    </div>}
  </TimetableDialog>
}
