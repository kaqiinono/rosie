'use client'

import { useState } from 'react'
import type { TaskExam } from '../../types'
import { validateTaskForm, useTasks, Field, inputClass, buttonClass, minorClass } from '../shared'
import TimetableDialog from './TimetableDialog'

export type ExamManagerProps = { calendarId?: string | null; courseId?: string }
const local = (s: string) => new Date(Date.parse(s) + 8 * 3600000).toISOString().slice(0, 16)
export default function ExamManager({ calendarId, courseId }: ExamManagerProps) {
  const { api, notify } = useTasks()
  const [editing, setEditing] = useState<Partial<TaskExam> | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TaskExam[] | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false)
  const exams = api.data.exams.filter(e => (!calendarId || e.calendar_id === calendarId) && (!courseId || e.course_id === courseId)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  async function removeExams() {
    if (!pendingDelete || busy) return
    setBusy(true); setError('')
    try { await api.rpc('task_clear_exams', { p_ids: pendingDelete.map(e => e.id) }); setPendingDelete(null); notify('考试已取消，站内提醒已清除') } catch (e) { setError(e instanceof Error ? e.message : '取消失败，请重试') } finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-800">考试 · {exams.length}</h3><div className="flex gap-2"><button className={minorClass} onClick={() => { setEditing({ calendar_id: calendarId || null, course_id: courseId || null, reminder_minutes: api.data.preferences[0] ? api.data.preferences[0].settings.default_reminder_minutes : 10 }); setDirty(false); setDiscard(false); setError('') }}>添加考试</button>{exams.length > 0 && <button className={minorClass} onClick={() => { setPendingDelete(exams); setError('') }}>清空当前考试</button>}</div></div>
    {!exams.length && <p className="text-sm text-slate-500">暂无考试安排。</p>}
    <ul className="divide-y divide-slate-100">{exams.map(e => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><button className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-emerald-700" onClick={() => { setEditing(e); setDirty(false); setDiscard(false); setError('') }}><span className="block font-medium text-slate-800">{e.title}</span><span className="text-sm text-slate-500">{new Date(e.starts_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} – {new Date(e.ends_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })}{e.location && ` · ${e.location}`}</span></button><button className={minorClass} onClick={() => { setPendingDelete([e]); setError('') }} aria-label={`取消考试 ${e.title}`}>取消考试</button></li>)}</ul>
    {editing && <TimetableDialog title={editing.id ? '编辑考试' : '添加考试'} description="时间均为北京时间；提醒仅在站内显示。" onClose={() => { if (!busy) { if (dirty) setDiscard(true); else setEditing(null) } }}>
      <form noValidate className="space-y-4" onChange={() => setDirty(true)} onSubmit={async event => {
        event.preventDefault(); if (busy) return; if (!validateTaskForm(event.currentTarget, 'exam-save-error')) { setError('请检查必填项、时间和提醒分钟范围'); return }; const f = new FormData(event.currentTarget); const title = String(f.get('title') || '').trim(), starts_at = String(f.get('start')), ends_at = String(f.get('end')); if (!title || ends_at <= starts_at) { setError('请输入名称，并确保结束晚于开始'); return }
        setBusy(true); setError(''); try { await api.save('exams', { id: editing.id, title, starts_at: new Date(`${starts_at}:00+08:00`).toISOString(), ends_at: new Date(`${ends_at}:00+08:00`).toISOString(), calendar_id: String(f.get('calendar') || '') || null, course_id: String(f.get('course') || '') || null, location: String(f.get('location') || '').trim(), notes: String(f.get('notes') || '').trim(), reminder_minutes: f.get('reminder') === '' ? null : Number(f.get('reminder')) }); setEditing(null); setDirty(false); notify('考试已保存') } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试') } finally { setBusy(false) }
      }}>
        <fieldset disabled={busy} className="space-y-4"><Field label="考试名称"><input required maxLength={200} name="title" defaultValue={editing.title || ''} className={inputClass} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="开始时间"><input required type="datetime-local" name="start" defaultValue={editing.starts_at ? local(editing.starts_at) : ''} className={inputClass} /></Field><Field label="结束时间"><input required type="datetime-local" name="end" defaultValue={editing.ends_at ? local(editing.ends_at) : ''} className={inputClass} /></Field></div>
        <Field label="所属课表"><select name="calendar" defaultValue={editing.calendar_id || ''} className={inputClass}><option value="">未分组</option>{api.data.calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="关联课程"><select name="course" defaultValue={editing.course_id || ''} className={inputClass}><option value="">不关联课程</option>{api.data.courses.filter(c => !c.archived_at || c.id === editing.course_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="地点"><input name="location" maxLength={500} defaultValue={editing.location || ''} className={inputClass} /></Field><Field label="备注"><textarea name="notes" maxLength={5000} defaultValue={editing.notes || ''} rows={Math.max(4, (editing.notes || '').split('\n').length + 1)} className={`${inputClass} resize-none`} /></Field><Field label="提前提醒（分钟，留空关闭）"><input type="number" min={0} max={10080} name="reminder" defaultValue={editing.reminder_minutes ?? ''} className={inputClass} /></Field>
        {error && <p id="exam-save-error" role="alert" className="text-sm text-red-700">{error}</p>}
        {discard ? <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>放弃未保存的考试修改？</p><button type="button" className={minorClass} onClick={() => setDiscard(false)}>继续编辑</button><button type="button" className={minorClass} onClick={() => { setDiscard(false); setEditing(null) }}>放弃修改</button></div> : <div className="flex justify-end gap-2"><button type="button" disabled={busy} className={minorClass} onClick={() => dirty ? setDiscard(true) : setEditing(null)}>取消</button><button disabled={busy} className={buttonClass}>{busy ? '保存中…' : '保存考试'}</button></div>}
        </fieldset>
      </form>
    </TimetableDialog>}
    {pendingDelete && <TimetableDialog title="确认取消考试" onClose={() => { if (!busy) setPendingDelete(null) }}><p className="text-sm text-slate-600">将取消 {pendingDelete.length} 场考试及其提醒。课程、任务和学习记录不受影响。</p><ul className="my-3 max-h-48 overflow-auto text-sm">{pendingDelete.map(e => <li key={e.id}>{e.title}</li>)}</ul>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button disabled={busy} className={minorClass} onClick={() => setPendingDelete(null)}>保留考试</button><button disabled={busy} className={buttonClass} onClick={() => void removeExams()}>{busy ? '处理中…' : '确认取消'}</button></div></TimetableDialog>}
  </section>
}
