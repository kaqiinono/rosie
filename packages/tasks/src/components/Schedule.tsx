'use client'

import PlanningDashboard from './planning/PlanningDashboard'
import { useState, type FormEvent } from 'react'
import { localDate, atTime, dateAfter, displayTime } from '../time'
import { previewOccurrences } from '../timetable'
import { buildCapacityIntervals } from '../planning/availability'
import { getTaskExecutionWindow } from '../planning/executionWindow'
import { applyFixedBlocks } from '../planning/fixedBlocks'
import type { TaskDemand } from '../planning/types'
import { getRemainingMinutes } from '../taskProgress'
import {
  useTasks,
  Panel,
  Field,
  inputClass,
  buttonClass,
  minorClass,
  WeekdaySelect,
  weekdays,
  text,
} from './shared'

export default function Schedule() {
  const { api, run, busy } = useTasks()
  const [date, setDate] = useState(localDate())
  const [task, setTask] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [configuration, setConfiguration] = useState('configured')
  const [error, setError] = useState('')
  const now = new Date().toISOString()
  const open = api.data.tasks.filter((t) => t.status === 'pending' || t.status === 'active')
  const dayStart = atTime(date, '00:00'),
    dayEnd = atTime(dateAfter(date, 1), '00:00')
  const calendarOccurrences = previewOccurrences(api.data, date, date)
  const built = buildCapacityIntervals({
    now: dayStart,
    horizon_end: dayEnd,
    day_states: api.data.day_states,
    windows: api.data.windows,
    courses: calendarOccurrences,
    exams: api.data.exams,
  })
  const demands: TaskDemand[] = api.data.tasks.flatMap((t) => {
    const window = getTaskExecutionWindow(t, now)
    // Undated explicit reservations supply only their own finite local target here.
    // This fixed-only display projection must never become movable solver demand.
    const explicitEnds = api.data.blocks
      .filter((b) => b.task_id === t.id)
      .map((b) => Date.parse(b.ends_at))
      .filter(Number.isFinite)
    const fixedTarget = explicitEnds.length
      ? new Date(Math.max(...explicitEnds)).toISOString()
      : null
    const deadline = window.due_at ?? fixedTarget
    return deadline
      ? [
          {
            key: t.id,
            task_id: t.id,
            course_id: t.course_id,
            batch_key: t.id,
            origin: 'actual' as const,
            release_at: window.release_at,
            due_at: deadline,
            remaining_minutes: getRemainingMinutes(t),
            priority: 0,
            certainty: 'confirmed' as const,
            source_revision: t.revision,
          },
        ]
      : []
  })
  const blocks = api.data.blocks.filter(
    (b) =>
      Date.parse(b.starts_at) < Date.parse(dayEnd) && Date.parse(b.ends_at) > Date.parse(dayStart),
  )
  const editedBlock = api.data.blocks.find((b) => b.id === editing)
  const accounting = applyFixedBlocks(demands, built.capacity, blocks, now)
  const free = applyFixedBlocks(
    [],
    built.capacity,
    blocks.filter((b) => b.id !== editing),
    now,
  ).remaining_capacity
  function submit(event: FormEvent<HTMLFormElement>, action: (f: FormData) => Promise<unknown>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.checkValidity()) {
      const invalid = form.querySelector<HTMLElement>(':invalid')
      invalid?.setAttribute('aria-invalid', 'true')
      invalid?.setAttribute('aria-describedby', 'schedule-error')
      invalid?.focus()
      setError('请填写必填字段，并检查日期和时间。')
      return
    }
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))
    setError('')
    const f = new FormData(form)
    void run(async () => {
      try {
        await action(f)
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存失败，请重试')
        throw e
      }
    })
  }
  return (
    <div className="space-y-5">
      <PlanningDashboard />
      <p id="schedule-error" role="alert" className="text-sm text-amber-800">
        {error}
      </p>
      <Panel title="可做作业的时间窗口">
        <p className="text-sm text-slate-600">
          每天手动配置；周六、周日的时段作为备用。指定日期覆盖当天全部周设置。
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((n) => {
            const state =
              api.data.day_states.find((s) => s.on_date === null && s.weekday === n)?.state ??
              (api.data.windows.some((w) => w.on_date === null && w.weekday === n && !w.unavailable)
                ? 'configured'
                : 'unconfigured')
            return (
              <span key={n} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                {weekdays[n]}
                {n === 0 || n === 6 ? ' · 备用' : ''}：
                {state === 'zero' ? '明确不可用' : state === 'configured' ? '已配置时段' : '待配置'}
              </span>
            )
          })}
        </div>
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) =>
            submit(e, async (f) => {
              const selectedDate = text(f, 'date') || null
              if (configuration === 'configured' && text(f, 'end') <= text(f, 'start'))
                throw new Error('结束时间必须晚于开始时间')
              await api.setAvailability(
                selectedDate ? null : Number(text(f, 'weekday')),
                selectedDate,
                configuration,
                configuration === 'configured' ? text(f, 'start') : null,
                configuration === 'configured' ? text(f, 'end') : null,
              )
            })
          }
        >
          <Field label="每周">
            <WeekdaySelect />
          </Field>
          <Field label="仅指定日期（覆盖当天周设置）">
            <input type="date" name="date" className={inputClass} />
          </Field>
          <Field label="可用状态">
            <select
              className={inputClass}
              value={configuration}
              onChange={(e) => setConfiguration(e.target.value)}
            >
              <option value="configured">配置时段（可添加多段）</option>
              <option value="zero">明确不可用（清空时段）</option>
              <option value="unconfigured">待配置（清空时段）</option>
            </select>
          </Field>
          {configuration === 'configured' && (
            <>
              <Field label="开始">
                <input
                  required
                  type="time"
                  name="start"
                  defaultValue="17:00"
                  className={inputClass}
                />
              </Field>
              <Field label="结束">
                <input
                  required
                  type="time"
                  name="end"
                  defaultValue="20:30"
                  className={inputClass}
                />
              </Field>
            </>
          )}
          <button disabled={busy} className={buttonClass}>
            {busy ? '保存中…' : configuration === 'configured' ? '添加时间窗口' : '保存可用状态'}
          </button>
        </form>
        {api.data.day_states
          .filter((s) => s.on_date)
          .map((s) => (
            <p key={s.id} className="text-sm">
              {s.on_date}：
              {s.state === 'zero'
                ? '明确不可用'
                : s.state === 'configured'
                  ? '已配置时段'
                  : '待配置'}{' '}
              <button
                disabled={busy}
                className={minorClass}
                onClick={() =>
                  void run(() => api.setAvailability(null, s.on_date, 'inherit', null, null))
                }
              >
                恢复周设置
              </button>
            </p>
          ))}
        {api.data.windows.map((w) => (
          <div key={w.id} className="flex justify-between gap-2 text-sm">
            <span>
              {w.on_date ?? weekdays[w.weekday]}{' '}
              {w.unavailable
                ? '不安排作业'
                : `${w.start_time.slice(0, 5)}—${w.end_time.slice(0, 5)}`}
            </span>
            <button
              disabled={busy}
              className={minorClass}
              onClick={() => void run(() => api.remove('windows', w.id))}
            >
              移除时段
            </button>
          </div>
        ))}
      </Panel>
      <Panel title="安排作业">
        <Field label="安排日期">
          <input
            required
            type="date"
            min={localDate()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value || localDate())
            }}
            className={inputClass}
          />
        </Field>
        {built.issues.map((i, n) => (
          <p key={n} className="text-sm text-amber-800">
            {i.detail}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          {free.map((w) => (
            <span
              key={w.key}
              className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {displayTime(w.start)}—{displayTime(w.end)}
              {w.kind === 'weekend_reserve' ? ' · 周末备用' : ''}
            </span>
          ))}
          {!free.length && (
            <p className="text-sm text-amber-800">当天没有剩余可用时间，请调整日期或时段。</p>
          )}
        </div>
        <form
          key={`${editing}:${date}`}
          noValidate
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) =>
            submit(e, async (f) => {
              const starts = atTime(date, text(f, 'start')),
                ends = atTime(date, text(f, 'end'))
              if (
                Date.parse(ends) <= Date.parse(starts) ||
                !free.some(
                  (w) =>
                    Date.parse(starts) >= Date.parse(w.start) &&
                    Date.parse(ends) <= Date.parse(w.end),
                )
              )
                throw new Error('请选择完整位于当前可用时段内的时间')
              const t = api.data.tasks.find((t) => t.id === task)
              if (!t || t.status === 'completed' || t.status === 'cancelled')
                throw new Error('请选择未完成任务')
              const window = getTaskExecutionWindow(t, now)
              if (window.issue && window.issue.code !== 'missing_deadline')
                throw new Error(window.issue.detail)
              if (
                Date.parse(starts) < Date.parse(window.release_at) ||
                (window.due_at && Date.parse(ends) > Date.parse(window.due_at))
              )
                throw new Error('安排必须在任务可开始和截止时间之内')
              await api.save('blocks', {
                ...(editing ? { id: editing } : {}),
                task_id: task,
                starts_at: starts,
                ends_at: ends,
              })
              setEditing(null)
            })
          }
        >
          <Field label="任务">
            <select
              required
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className={inputClass}
            >
              <option value="">选择任务</option>
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}（剩余 {getRemainingMinutes(t)} 分钟）
                </option>
              ))}
            </select>
          </Field>
          <Field label="开始">
            <input
              required
              type="time"
              name="start"
              defaultValue={
                editedBlock?.starts_at
                  ? new Date(editedBlock!.starts_at).toLocaleTimeString('en-GB', {
                      timeZone: 'Asia/Shanghai',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''
              }
              className={inputClass}
            />
          </Field>
          <Field label="结束">
            <input
              required
              type="time"
              name="end"
              defaultValue={
                editedBlock?.ends_at
                  ? new Date(editedBlock!.ends_at).toLocaleTimeString('en-GB', {
                      timeZone: 'Asia/Shanghai',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''
              }
              className={inputClass}
            />
          </Field>
          <button disabled={busy} className={buttonClass}>
            {busy ? '保存中…' : editing ? '保存移动后的安排' : '安排这一段时间'}
          </button>
          {editing && (
            <button type="button" className={minorClass} onClick={() => setEditing(null)}>
              取消移动
            </button>
          )}
        </form>
        {open.map((t) => {
          const remaining =
            accounting.remaining_demands.find((d) => d.task_id === t.id)?.remaining_minutes ??
            getRemainingMinutes(t)
          return (
            <p key={t.id} className="text-sm text-slate-600">
              {t.title} · 剩余 {getRemainingMinutes(t)} 分钟 / 当天安排后还需 {remaining} 分钟
              {getTaskExecutionWindow(t, now).deadline_source === 'suggested_recovery'
                ? ' · 使用今天23:59建议补做目标（原截止不变）'
                : ''}
              {t.due_at === null ? ' · 无截止，仅固定覆盖部分纳入安排，剩余待设目标' : ''}
            </p>
          )
        })}
      </Panel>
      <Panel title="已安排的时间">
        <p className="text-sm text-slate-500">
          固定安排保留占用；经过的时间不等于完成。冲突或多余时间请手动调整或释放。
        </p>
        {blocks.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
          >
            <div>
              <strong>{api.data.tasks.find((t) => t.id === b.task_id)?.title}</strong>
              <p className="text-sm">
                {displayTime(b.starts_at)}—{displayTime(b.ends_at)}
              </p>
              {accounting.conflicts
                .filter((i) => i.affected_keys.includes(b.id))
                .map((i, n) => (
                  <p key={n} className="text-sm text-amber-800">
                    {i.detail}
                  </p>
                ))}
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={minorClass}
                onClick={() => {
                  setEditing(b.id)
                  setTask(b.task_id)
                }}
              >
                移动安排
              </button>
              <button
                disabled={busy}
                className={minorClass}
                onClick={() => void run(() => api.remove('blocks', b.id))}
              >
                释放时间
              </button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}
