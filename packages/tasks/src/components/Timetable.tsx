'use client'

import { useState, type FormEvent } from 'react'
import type { CourseOccurrence, Subject, TimetableRule } from '../types'
import { localDate, dateAfter, atTime } from '../time'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, CourseSelect, SubjectSelect, WeekdaySelect, weekdays, text } from './shared'

function weekStart(date: string): string {
  return dateAfter(date, -((new Date(atTime(date, '12:00')).getUTCDay() + 6) % 7))
}

const clockTime = (value: string) => new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const statusLabel = { scheduled: '待上课/确认', confirmed: '已确认', cancelled: '已停课' }
type CalendarEntry = { occurrence: CourseOccurrence; start: number; end: number; lane: number; lanes: number }

function layoutDay(occurrences: CourseOccurrence[], date: string): CalendarEntry[] {
  const midnight = +new Date(atTime(date, '00:00'))
  const entries: CalendarEntry[] = occurrences.flatMap(occurrence => {
    const start = Math.max(0, (+new Date(occurrence.starts_at) - midnight) / 60000)
    const end = Math.min(1440, (+new Date(occurrence.ends_at) - midnight) / 60000)
    return start < end ? [{ occurrence, start, end, lane: 0, lanes: 1 }] : []
  }).sort((a, b) => a.start - b.start || b.end - a.end)
  let group: CalendarEntry[] = []
  let laneEnds: number[] = []
  let groupEnd = 0
  const finishGroup = () => { group.forEach(entry => { entry.lanes = laneEnds.length }) }
  for (const entry of entries) {
    if (entry.start >= groupEnd) { finishGroup(); group = []; laneEnds = [] }
    const freeLane = laneEnds.findIndex(end => end <= entry.start)
    entry.lane = freeLane < 0 ? laneEnds.length : freeLane
    laneEnds[entry.lane] = entry.end
    group.push(entry)
    groupEnd = Math.max(groupEnd, entry.end)
  }
  finishGroup()
  return entries
}

function WeekCalendar({ week, onWeekChange, onSelect }: { week: string; onWeekChange: (date: string) => void; onSelect: (occurrence: CourseOccurrence) => void }) {
  const { api } = useTasks()
  const today = localDate()
  const days = Array.from({ length: 7 }, (_, index) => dateAfter(week, index))
  const columns = days.map(date => layoutDay(api.data.occurrences, date))
  const entries = columns.flat()
  const firstHour = Math.floor(Math.min(8 * 60, ...entries.map(entry => entry.start)) / 60)
  const lastHour = Math.ceil(Math.max(22 * 60, ...entries.map(entry => entry.end)) / 60)
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index)
  const height = (lastHour - firstHour) * 80
  return <Panel title="周课表">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={minorClass} onClick={() => onWeekChange(dateAfter(week, -7))}>上一周</button>
        <button type="button" className={minorClass} onClick={() => onWeekChange(weekStart(today))}>本周</button>
        <button type="button" className={minorClass} onClick={() => onWeekChange(dateAfter(week, 7))}>下一周</button>
        <span className="text-sm font-semibold text-slate-700">{week} — {dateAfter(week, 6)}</span>
      </div>
      <Field label="跳转到所在周"><input type="date" value={week} onChange={e => { if (e.target.value) onWeekChange(weekStart(e.target.value)) }} className={inputClass} /></Field>
    </div>
    {!entries.length && <p className="text-sm text-slate-500">本周暂无课程，课表滚动生成未来五周。</p>}
    <p className="text-xs text-slate-500">点击课程可停课或调课；手机可左右滑动查看整周。</p>
    <div role="region" aria-label="每周课程日历，可横向和纵向滚动" tabIndex={0} className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-600">
      <div className="min-w-[900px]">
        <div className="sticky top-0 z-30 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-white">
          <div className="sticky left-0 z-10 bg-white px-1 py-3 text-center text-xs text-slate-500">时间</div>
          {days.map((date, index) => <div key={date} aria-current={date === today ? 'date' : undefined} className={`border-l border-slate-200 py-3 text-center text-sm ${date === today ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-600'}`}>
            <div>{weekdays[(index + 1) % 7]}{date === today && ' · 今天'}</div><div className="mt-1 text-xs">{date.slice(5).replace('-', '/')}</div>
          </div>)}
        </div>
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="sticky left-0 z-20 bg-white" style={{ height }}>
            {hours.map(hour => <span key={hour} className="absolute right-2 text-[11px] text-slate-400" style={{ top: (hour - firstHour) * 80, transform: hour === firstHour ? undefined : 'translateY(-100%)' }}>{String(hour).padStart(2, '0')}:00</span>)}
          </div>
          {days.map((date, index) => <div key={date} className={`relative border-l border-slate-200 ${date === today ? 'bg-indigo-50/40' : 'bg-white'}`} style={{ height }}>
            {hours.slice(0, -1).map(hour => <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: (hour - firstHour) * 80, height: 80 }}><div className="mt-10 border-t border-dashed border-slate-100" /></div>)}
            {columns[index].map(({ occurrence, start, end, lane, lanes }) => {
              const name = api.data.courses.find(course => course.id === occurrence.course_id)?.name ?? '课程'
              const label = `${name} · ${clockTime(occurrence.starts_at)}—${clockTime(occurrence.ends_at)} · ${statusLabel[occurrence.status]}`
              return <button key={occurrence.id} type="button" disabled={occurrence.status === 'confirmed'} title={label} aria-label={label} onClick={() => onSelect(occurrence)} className={`absolute overflow-auto rounded-lg border px-2 py-1 text-left text-xs focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-indigo-600 ${occurrence.status === 'cancelled' ? 'border-slate-200 bg-slate-100 text-slate-500' : occurrence.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-indigo-200 bg-indigo-100 text-indigo-900 hover:bg-indigo-200'}`} style={{ top: (start - firstHour * 60) / 60 * 80, height: (end - start) / 60 * 80, left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
                <strong className={`block break-words ${occurrence.status === 'cancelled' ? 'line-through' : ''}`}>{name}</strong>
                <span className="mt-1 block">{clockTime(occurrence.starts_at)}—{clockTime(occurrence.ends_at)}</span>
                <span className="mt-1 block">{statusLabel[occurrence.status]}</span>
              </button>
            })}
          </div>)}
        </div>
      </div>
    </div>
  </Panel>
}

export default function Timetable() {
  const { api, run, busy } = useTasks()
  const [course, setCourse] = useState('')
  const [subject, setSubject] = useState<Subject | ''>('chinese')
  const [week, setWeek] = useState(() => weekStart(localDate()))
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
  return <div className="space-y-5">
    <WeekCalendar week={week} onWeekChange={date => { setWeek(date); setException(null) }} onSelect={setException} />
    {exception && <Panel title="本次停课 / 调课">
      <form key={exception.id} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const existing = api.data.exceptions.find(x => x.rule_id === exception.rule_id && x.original_date === exception.original_date); const cancelled = f.get('cancelled') === 'on'; await api.save('exceptions', { id: existing?.id, rule_id: exception.rule_id, original_date: exception.original_date, cancelled, starts_at: cancelled ? null : atTime(text(f, 'date'), text(f, 'start')), ends_at: cancelled ? null : atTime(text(f, 'date'), text(f, 'end')) }); await api.refresh(); setException(null) }) }}>
        <strong className="sm:col-span-2">仅修改 {exception.original_date} 的 {courseName(exception.course_id)}</strong>
        <label><input type="checkbox" name="cancelled" /> 本次停课</label><Field label="改至日期"><input required type="date" name="date" defaultValue={localDate(new Date(exception.starts_at))} className={inputClass} /></Field>
        <Field label="开始"><input required type="time" name="start" defaultValue={new Date(exception.starts_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })} className={inputClass} /></Field>
        <Field label="结束"><input required type="time" name="end" defaultValue={new Date(exception.ends_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })} className={inputClass} /></Field>
        <button disabled={busy} className={buttonClass}>保存本次调整</button><button type="button" className={minorClass} onClick={() => setException(null)}>取消</button>
      </form>
    </Panel>}
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

  </div>
}
