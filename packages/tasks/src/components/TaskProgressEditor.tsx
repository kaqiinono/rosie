'use client'
import { useState } from 'react'
import type { TaskInstance } from '../types'
import { getRemainingMinutes, getTaskCompletion } from '../taskProgress'
import { Field, inputClass, minorClass, useTasks } from './shared'
export default function TaskProgressEditor({ task }: { task: TaskInstance }) {
  const { api, run, busy } = useTasks()
  const [error, setError] = useState('')
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <p className="text-sm text-slate-600 tabular-nums">
        完成 {Math.round(getTaskCompletion(task) * 100)}% · 剩余 {getRemainingMinutes(task)} 分钟
      </p>
      {task.progress_mode === 'percentage' && task.status !== 'cancelled' && (
        <form
          noValidate
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const percent = Number(new FormData(e.currentTarget).get('percent'))
            if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
              setError('请输入 0–100 的整数百分比')
              return
            }
            setError('')
            void run(() => api.setCompletion(task, percent))
          }}
        >
          <Field label="完成百分比（0–100）">
            <input
              key={`${task.id}:${task.revision}`}
              className={inputClass}
              name="percent"
              type="number"
              min={0}
              max={100}
              defaultValue={task.completion_percent}
            />
          </Field>
          <button disabled={busy} className={minorClass}>
            保存进度
          </button>
        </form>
      )}
      <form
        noValidate
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const minutes = Number(new FormData(e.currentTarget).get('minutes'))
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
            setError('请输入 1–1440 的整数分钟')
            return
          }
          setError('')
          void run(() => api.setEstimate(task, minutes))
        }}
      >
        <Field label="预计分钟">
          <input
            key={`${task.id}:${task.estimated_minutes}`}
            className={inputClass}
            name="minutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={task.estimated_minutes}
          />
        </Field>
        <button disabled={busy} className={minorClass}>
          调整时长
        </button>
      </form>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">
          调整名称、内容与截止时间
        </summary>
        <form
          noValidate
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const title = String(f.get('title') ?? '').trim()
            if (!title) {
              setError('请输入任务名称')
              return
            }
            const due = String(f.get('due') ?? '')
            const content = String(f.get('content') ?? '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
            void run(() =>
              api.save('tasks', {
                id: task.id,
                revision: task.revision,
                title,
                ...(due ? { due_at: new Date(`${due}+08:00`).toISOString() } : {}),
                ...(task.subject !== 'math' &&
                !task.course_event_id &&
                content.join('\n') !== task.items.map((i) => i.label).join('\n')
                  ? { items: content.map((label, i) => ({ id: String(i), label, done: false })) }
                  : {}),
              }),
            )
          }}
        >
          <Field label="名称">
            <input name="title" defaultValue={task.title} className={inputClass} />
          </Field>
          {task.subject !== 'math' && !task.course_event_id && (
            <Field label="实际内容（每行一项；修改后保留旧修订并重新开始）">
              <textarea
                name="content"
                className={`${inputClass} min-h-24 resize-none`}
                defaultValue={task.items.map((i) => i.label).join('\n')}
              />
            </Field>
          )}
          <Field label="新截止时间（留空保留）">
            <input type="datetime-local" name="due" className={inputClass} />
          </Field>
          <button disabled={busy} className={minorClass}>
            保存调整
          </button>
        </form>
      </details>
    </div>
  )
}
