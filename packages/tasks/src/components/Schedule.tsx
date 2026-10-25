'use client'

import { useState } from 'react'
import { localDate, atTime, freeIntervals, displayTime, blockNeedsReschedule } from '../time'
import { previewOccurrences } from '../timetable'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, WeekdaySelect, weekdays, text } from './shared'

export default function Schedule() {
  const { api, run, busy } = useTasks()
  const [date, setDate] = useState(localDate())
  const [task, setTask] = useState('')
  const open = api.data.tasks.filter(t => t.status === 'pending' || t.status === 'active')
  const activeBlocks = api.data.blocks.filter(b => open.some(t => t.id === b.task_id))
  const calendarOccurrences = previewOccurrences(api.data, date, date)
  const free = freeIntervals(date, api.data.windows, calendarOccurrences, activeBlocks)
  return <div className="space-y-5">
    <Panel title="可做作业的时间窗口"><form className="grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const unavailable = f.get('closed') === 'on'; if (unavailable && !text(f, 'date')) throw new Error('请指定不安排作业的日期'); if (unavailable && api.data.windows.some(w => w.on_date === text(f, 'date'))) throw new Error('请先移除这一天已有的单日窗口'); if (!unavailable && api.data.windows.some(w => w.on_date === text(f, 'date') && w.unavailable)) throw new Error('请先移除这一天的不安排作业设置'); await api.save('windows', { weekday: Number(text(f, 'weekday')), on_date: text(f, 'date') || null, start_time: text(f, 'start'), end_time: text(f, 'end'), unavailable }) }) }}>
      <Field label="每周"><WeekdaySelect /></Field><Field label="仅指定日期（覆盖当天周设置）"><input type="date" name="date" className={inputClass} /></Field><span />
      <Field label="开始"><input required type="time" name="start" defaultValue="17:00" className={inputClass} /></Field><Field label="结束"><input required type="time" name="end" defaultValue="20:30" className={inputClass} /></Field><button disabled={busy} className={buttonClass}>添加时间窗口</button>
      <label className="text-sm"><input type="checkbox" name="closed" /> 指定日期不安排作业</label>
    </form>
    {api.data.windows.map(w => <div key={w.id} className="flex justify-between gap-2 text-sm"><span>{w.on_date ?? weekdays[w.weekday]} {w.unavailable ? '不安排作业' : `${w.start_time.slice(0, 5)}—${w.end_time.slice(0, 5)}`}</span><button disabled={busy} className={minorClass} onClick={() => void run(() => api.remove('windows', w.id))}>移除</button></div>)}
    </Panel>
    <Panel title="安排作业"><Field label="安排日期"><input required type="date" min={localDate()} value={date} onChange={e => setDate(e.target.value || localDate())} className={inputClass} /></Field>
      <div className="flex flex-wrap gap-2">{free.map(w => <span key={w.start} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{displayTime(new Date(w.start).toISOString())}—{displayTime(new Date(w.end).toISOString())}</span>)}{!free.length && <p className="text-sm text-amber-700">当天没有剩余可用时间，请选择其他日期或调整时间窗口。</p>}</div>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const starts = atTime(date, text(f, 'start')); const ends = atTime(date, text(f, 'end')); if (!free.some(w => +new Date(starts) >= w.start && +new Date(ends) <= w.end) || ends <= starts) throw new Error('请选择完整位于可用时段内的时间'); await api.save('blocks', { task_id: task, starts_at: starts, ends_at: ends }) }) }}>
        <Field label="任务"><select required value={task} onChange={e => setTask(e.target.value)} className={inputClass}><option value="">选择任务</option>{open.map(t => <option key={t.id} value={t.id}>{t.title}（预计 {t.estimated_minutes} 分钟）</option>)}</select></Field>
        <Field label="开始"><input required type="time" name="start" className={inputClass} /></Field><Field label="结束"><input required type="time" name="end" className={inputClass} /></Field><button disabled={busy} className={buttonClass}>安排这一段时间</button>
      </form>
      {open.map(t => { const minutes = activeBlocks.filter(b => b.task_id === t.id).reduce((n, b) => n + (+new Date(b.ends_at) - +new Date(b.starts_at)) / 60000, 0); return <p key={t.id} className="text-sm text-slate-600">{t.title} · 预计 {t.estimated_minutes} 分钟 / 已安排 {minutes} 分钟{minutes < t.estimated_minutes ? ` / 还需安排 ${t.estimated_minutes - minutes} 分钟` : ''}</p> })}
    </Panel>
    <Panel title="已安排的时间"><p className="text-sm text-slate-500">一项任务可安排多个时间块；调整课表后请处理冲突。</p>
      {api.data.blocks.filter(b => localDate(new Date(b.starts_at)) === date).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(b => <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><div><strong>{api.data.tasks.find(t => t.id === b.task_id)?.title}</strong><p className="text-sm">{displayTime(b.starts_at)}—{displayTime(b.ends_at)}</p>{activeBlocks.some(x => x.id === b.id) && blockNeedsReschedule(b, api.data.windows, calendarOccurrences, activeBlocks) && <p className="text-sm font-bold text-amber-700">需要重新安排：可用窗口或课程发生冲突</p>}</div><button disabled={busy} className={minorClass} onClick={() => void run(() => api.remove('blocks', b.id))}>移除安排</button></div>)}
    </Panel>
  </div>
}
