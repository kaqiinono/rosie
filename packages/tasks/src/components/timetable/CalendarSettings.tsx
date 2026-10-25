'use client'

import { useState } from 'react'
import type { TimetablePreferences, TimetableSnapshotPayload } from '../../types'
import { DEFAULT_TIMETABLE_PREFERENCES } from '../../timetable'
import { schedulePayload } from '../../transfer'
import { Field, inputClass, buttonClass, minorClass, useTasks } from '../shared'
import TimetableDialog from './TimetableDialog'

export type CalendarSettingsProps = { calendarId?: string | null; onCalendarChange?: (id: string) => void }
export default function CalendarSettings({ calendarId, onCalendarChange }: CalendarSettingsProps) {
  const { api, notify } = useTasks()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [termDirty, setTermDirty] = useState(false), [settingsDirty, setSettingsDirty] = useState(false), [discard, setDiscard] = useState(false)
  const [pendingTerm, setPendingTerm] = useState<string | null>(null)
  const [settings, setSettings] = useState<TimetablePreferences>(DEFAULT_TIMETABLE_PREFERENCES)
  const [termId, setTermId] = useState(''), [name, setName] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [copyFrom, setCopyFrom] = useState('')
  const selectTerm = (id: string) => { const c = api.data.calendars.find(r => r.id === id); setTermId(c?.id || ''); setName(c?.name || ''); setStart(c?.starts_on || ''); setEnd(c?.ends_on || ''); setCopyFrom(''); setTermDirty(false); setPendingTerm(null) }
  const close = () => { if (!busy) { if (termDirty || settingsDirty) setDiscard(true); else setOpen(false) } }
  const change = <K extends keyof TimetablePreferences>(key: K, value: TimetablePreferences[K]) => { setSettings(previous => ({ ...previous, [key]: value })); setSettingsDirty(true) }
  async function saveTerm() {
    if (busy) return
    if (!name.trim() || !start || (end && end < start)) { setError('填写课表名称和有效起止日期'); return }
    setBusy(true); setError('')
    try {
      let selected: string
      if (copyFrom && !termId) {
        const source = api.data.calendars.find(c => c.id === copyFrom)
        if (!source) throw new Error('来源课表已不存在')
        const delta = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${source.starts_on}T00:00:00Z`)) / 86400000)
        if (delta % 7 !== 0) throw new Error('复制学期的开始日须与原学期为同一星期，以保持重复周规则；请调整开始日')
        const shift = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10)
        const shiftStamp = (d: string) => new Date(Date.parse(d) + delta * 86400000).toISOString()
        const payload = schedulePayload(api.data, copyFrom)
        const copied: TimetableSnapshotPayload = { ...payload, calendars: [{ ...payload.calendars[0], name: name.trim(), starts_on: start, ends_on: end || null }], rules: payload.rules.map(r => ({ ...r, weekday: ((r.weekday + delta) % 7 + 7) % 7, valid_from: shift(r.valid_from), valid_until: r.valid_until ? shift(r.valid_until) : end || null, anchor_date: shift(r.anchor_date || r.valid_from), disabled_from: r.disabled_from ? shift(r.disabled_from) : null })), exams: payload.exams.map(e => ({ ...e, starts_at: shiftStamp(e.starts_at), ends_at: shiftStamp(e.ends_at) })), exceptions: payload.exceptions?.map(e => ({ ...e, original_date: shift(e.original_date), starts_at: e.starts_at ? shiftStamp(e.starts_at) : null, ends_at: e.ends_at ? shiftStamp(e.ends_at) : null })) }
        selected = String(await api.rpc('task_import_timetable', { p_payload: copied, p_calendar: null, p_name: name.trim(), p_import_key: `copy:${copyFrom}:${name.trim()}:${start}:${end}` }))
      } else { const row = await api.save('calendars', { id: termId || undefined, name: name.trim(), starts_on: start, ends_on: end || null }); selected = row.id }
      setTermId(selected); setCopyFrom(''); setTermDirty(false); onCalendarChange?.(selected); notify('课表已保存')
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试') } finally { setBusy(false) }
  }
  return <><button className={minorClass} onClick={() => { setSettings(api.data.preferences[0]?.settings || DEFAULT_TIMETABLE_PREFERENCES); const c = api.data.calendars.find(row => row.id === calendarId); setTermId(c?.id || ''); setName(c?.name || ''); setStart(c?.starts_on || ''); setEnd(c?.ends_on || ''); setCopyFrom(''); setTermDirty(false); setSettingsDirty(false); setPendingTerm(null); setDiscard(false); setError(''); setOpen(true) }}>课表与设置</button>
    {open && <TimetableDialog title="课表 / 学期与显示设置" onClose={close}><fieldset disabled={busy} className="space-y-6">
      <form className="space-y-3 rounded-xl border border-slate-200 p-3" onChange={e => { if (!(e.target instanceof HTMLSelectElement && e.target.name === 'termChoice')) setTermDirty(true) }} onSubmit={e => { e.preventDefault(); void saveTerm() }}>
        <h3 className="font-semibold">命名课表 / 学期</h3><Field label="编辑课表"><select name="termChoice" className={inputClass} value={termId} onChange={e => { if (termDirty) setPendingTerm(e.target.value); else selectTerm(e.target.value) }}><option value="">创建新课表</option>{api.data.calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {pendingTerm !== null && <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>切换课表会放弃当前未保存的学期资料。</p><button type="button" className={minorClass} onClick={() => setPendingTerm(null)}>继续编辑</button><button type="button" className={minorClass} onClick={() => selectTerm(pendingTerm)}>放弃并切换</button></div>}<Field label="课表名称"><input className={inputClass} required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="学期开始"><input required type="date" className={inputClass} value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="学期结束（可选）"><input type="date" min={start} className={inputClass} value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
        {!termId && <Field label="复制现有课表（可选）"><select className={inputClass} value={copyFrom} onChange={e => setCopyFrom(e.target.value)}><option value="">空白课表</option>{api.data.calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        {copyFrom && <p className="text-sm text-amber-800">按两个学期开始日的天数差平移课程、考试与调课日期，两个开始日须为同一星期，以保留星期与重复周安排；原课表保留。学习记录不会复制。</p>}
        {termId && <p className="text-xs text-slate-500">学期日期用于组织课表；已有课程的有效期由课程编辑器单独管理。</p>}
        <button disabled={busy} className={buttonClass}>{busy ? '处理中…' : copyFrom ? '复制到新课表' : '保存课表'}</button>
      </form>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (busy) return; if (settings.start_hour >= settings.end_hour) { setError('结束小时必须大于开始小时'); return } setBusy(true); setError(''); try { await api.save('preferences', { id: api.data.preferences[0]?.id, settings }); setSettingsDirty(false); notify('显示设置已保存') } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败') } finally { setBusy(false) } }}>
        <h3 className="font-semibold">显示与提醒</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="每周开始"><select className={inputClass} value={settings.week_start} onChange={e => change('week_start', e.target.value === '0' ? 0 : 1)}><option value={1}>周一</option><option value={0}>周日</option></select></Field><Field label="时钟格式"><select className={inputClass} value={settings.hour12 ? '12' : '24'} onChange={e => change('hour12', e.target.value === '12')}><option value="24">24 小时</option><option value="12">12 小时</option></select></Field><Field label="开始小时"><input className={inputClass} type="number" min={0} max={23} value={settings.start_hour} onChange={e => change('start_hour', Number(e.target.value))} /></Field><Field label="结束小时"><input className={inputClass} type="number" min={1} max={24} value={settings.end_hour} onChange={e => change('end_hour', Number(e.target.value))} /></Field><Field label="每小时高度（像素）"><input className={inputClass} type="number" min={40} max={160} value={settings.hour_height} onChange={e => change('hour_height', Number(e.target.value))} /></Field><Field label="新课程默认提前提醒（分钟，留空关闭）"><input type="number" min={0} max={10080} className={inputClass} value={settings.default_reminder_minutes ?? ''} onChange={e => change('default_reminder_minutes', e.target.value === '' ? null : Number(e.target.value))} /></Field></div>
        <div className="flex flex-wrap gap-4">{(['show_weekends', 'show_teacher', 'show_location'] as const).map((key, index) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key]} onChange={e => change(key, e.target.checked)} />{['显示周末', '显示教师', '显示地点'][index]}</label>)}</div><p className="text-xs text-slate-500">提醒仅在站内显示，关闭页面后不会发送系统通知。</p><button disabled={busy} className={buttonClass}>{busy ? '保存中…' : '保存显示设置'}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {discard && <div className="rounded-xl bg-amber-50 p-3"><p className="mb-2 text-sm">放弃尚未保存的修改？</p><button className={minorClass} onClick={() => setDiscard(false)}>继续编辑</button><button className={minorClass} onClick={() => { setDiscard(false); setOpen(false) }}>放弃修改</button></div>}
      <button disabled={busy} className={minorClass} onClick={close}>关闭</button>
    </fieldset></TimetableDialog>}
  </>
}
