'use client'
import { useState } from 'react'
import type { TaskInstance } from '../../types'
import { atTime } from '../../time'
import { getTaskExecutionWindow } from '../../planning/executionWindow'
import { Field, inputClass, minorClass, useTasks } from '../shared'
import { planningTime } from './presentation'
export default function RecoveryTargetEditor({ task, now }: { task: TaskInstance; now: number }) {
  const { api, run, busy, notify } = useTasks()
  const [error, setError] = useState('')
  const window = getTaskExecutionWindow(task, new Date(now).toISOString())
  return (
    <details className="rounded-xl border border-amber-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2">
        补做目标 · {task.recovery_due_at ? '已明确设置' : '建议目标（未保存）'}
      </summary>
      <p className="py-2 text-sm">
        原截止 {task.due_at && planningTime(task.due_at)}，仍标记逾期。
        {window.due_at ? `补做目标 ${planningTime(window.due_at)}` : '请设置未来补做目标'}
        ；补做安排不代表原截止按时完成。
      </p>
      <form
        noValidate
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const f = new FormData(form)
          const date = String(f.get('date') ?? '')
          const time = String(f.get('time') ?? '')
          const due = date && time ? atTime(date, time) : ''
          if (!due || Date.parse(due) <= Date.now()) {
            setError('请选择未来的补做日期与时间')
            form.querySelector<HTMLInputElement>('input')?.focus()
            return
          }
          setError('')
          void run(() => api.setRecoveryDue(task.id, due, task.revision)).then((ok) => {
            if (ok) notify('补做目标已保存；原截止时间保留')
            else setError('保存失败，请检查页面错误后重试；输入已保留。')
          })
        }}
      >
        <Field label="补做日期（上海）">
          <input
            required
            name="date"
            type="date"
            className={inputClass}
            aria-invalid={!!error}
            aria-describedby={`recovery-error-${task.id}`}
          />
        </Field>
        <Field label="补做时间">
          <input required name="time" type="time" defaultValue="23:59" className={inputClass} />
        </Field>
        <button disabled={busy} className={minorClass}>
          保存补做目标
        </button>
        <button
          disabled={busy || !task.recovery_due_at}
          type="button"
          className={minorClass}
          onClick={() =>
            void run(() => api.setRecoveryDue(task.id, null, task.revision)).then((ok) => {
              if (ok) notify('已清除明确补做目标，将使用建议目标；原截止保留')
            })
          }
        >
          清除明确目标
        </button>
        <p
          id={`recovery-error-${task.id}`}
          role="alert"
          className="text-sm text-amber-900 sm:col-span-3"
        >
          {error}
        </p>
      </form>
    </details>
  )
}
