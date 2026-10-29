'use client'

import type { CourseDeadlinePolicy } from '../../courseTypes'
import { localDate } from '../../time'
import { clockTime } from './presentation'
import { Field, inputClass } from '../shared'

type Props = { value: CourseDeadlinePolicy | null; flexible: boolean; onChange: (value: CourseDeadlinePolicy | null) => void }
const defaults: CourseDeadlinePolicy = { kind: 'next_class', time: '20:30', days: 1, at: null }
/** Course policy only; pool inheritance and event-time resolution belong to the event engine. */
export default function CourseDeadlineFields({ value, flexible, onChange }: Props) {
  return <div className="space-y-3 rounded-xl bg-slate-50 p-3">
    <Field label="课程默认截止策略"><select className={inputClass} value={value?.kind ?? 'system'} onChange={e => onChange(e.target.value === 'system' ? null : { ...(value ?? defaults), kind: e.target.value as CourseDeadlinePolicy['kind'], at: e.target.value === 'fixed' ? value?.at ?? null : null })}>
      <option value="system">系统默认：下次上课前</option><option value="next_class">下次上课前</option><option value="same_day">事件当天</option><option value="days_after">事件后若干天</option><option value="fixed">固定日期时间</option>
    </select></Field>
    <p className="text-xs text-slate-600">继承课程默认的任务使用此设置；任务池已有的具体截止设置优先。系统默认：课表课程在下次上课开始时截止，自由课程在下次上课前一天 20:30 截止。</p>
    {value && value.kind !== 'fixed' && <div className="grid gap-3 sm:grid-cols-2">
      {(value.kind === 'days_after' || value.kind === 'next_class') && <Field label={value.kind === 'next_class' ? '自由课程提前天数' : '事件后天数'}><input required className={inputClass} type="number" min={0} max={365} step={1} value={value.days} onChange={e => onChange({ ...value, days: e.target.valueAsNumber })} /></Field>}
      <Field label="默认截止时刻"><input required className={inputClass} type="time" value={value.time} onChange={e => onChange({ ...value, time: e.target.value })} /></Field>
      {value.kind === 'next_class' && !flexible && <p className="text-xs text-slate-500 sm:col-span-2">课表课程使用下次事件的实际开始时间；以上天数和时刻仅用于日期型事件。</p>}
    </div>}
    {value?.kind === 'fixed' && <Field label="固定截止日期时间"><input required className={inputClass} type="datetime-local" value={value.at ? `${localDate(new Date(value.at))}T${clockTime(value.at)}` : ''} onChange={e => onChange({ ...value, at: e.target.value ? `${e.target.value}:00+08:00` : null })} /></Field>}
  </div>
}
