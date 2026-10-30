'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TaskInstance, ProblemOption, ProblemGroup } from '../types'
import { Field, inputClass, minorClass, useTasks, safeHref } from './shared'
const groups: Record<ProblemGroup, string> = {
  lesson: '课堂例题',
  homework: '课后巩固',
  pretest: '课前测',
  workbook: '练习册',
  supplement: '补充题',
}
export default function MathTaskItems({ task }: { task: TaskInstance }) {
  const { api, catalog, run, busy } = useTasks()
  const [lesson, setLesson] = useState(
    task.lesson?.key ?? (task.items[0] ? decodeURIComponent(task.items[0].id.split(':')[0]) : ''),
  )
  const itemSource =
    task.template_snapshot?.item_source ??
    api.data.templates.find((t) => t.id === task.template_id)?.item_source
  const [group, setGroup] = useState<ProblemGroup>(itemSource === 'class' ? 'lesson' : 'homework')
  const [attempt, setAttempt] = useState(0)
  const [known, setKnown] = useState<Record<string, ProblemOption>>({})
  const [tag, setTag] = useState(''),
    [query, setQuery] = useState('')
  const [problems, setProblems] = useState<ProblemOption[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>(task.items.map((i) => i.id))
  useEffect(() => {
    let active = true
    if (!lesson) return
    void Promise.resolve()
      .then(() => {
        if (active) {
          setProblems([])
          setError('')
          setLoading(true)
        }
        return catalog.loadMathProblems(lesson)
      })
      .then((rows) => {
        if (active) {
          setProblems(rows)
          setKnown((prev) => ({
            ...prev,
            ...Object.fromEntries(rows.map((p) => [p.stable_key, p])),
          }))
        }
      })
      .catch(() => {
        if (active) setError('题库暂时无法加载，请重试')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [catalog, lesson, attempt])
  const options = problems.filter(
    (p) =>
      p.group === group &&
      (!tag || p.tags.includes(tag)) &&
      (!query || `${p.displayId} ${p.title}`.includes(query)),
  )
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {task.items.map((item) => {
          const problem = problems.find((p) => p.stable_key === item.id)
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
              <label>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={busy || task.status === 'cancelled'}
                  onChange={(e) => void run(() => api.setItemDone(task, item.id, e.target.checked))}
                />{' '}
                {item.label}
              </label>
              {safeHref(problem?.href ?? item.href) && (
                <Link
                  className="text-indigo-700 underline"
                  href={safeHref(problem?.href ?? item.href)!}
                >
                  查看题目
                </Link>
              )}
              {problem?.replay_ref && catalog.renderProblemReplay?.(problem)}
            </li>
          )
        })}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">
          {task.selection_state === 'pending' ? '待选题' : '调整题目'}
        </summary>
        <div className="mt-3 space-y-3">
          <Field label="讲次">
            <select
              className={inputClass}
              value={lesson}
              onChange={(e) => {
                setLesson(e.target.value)
                setTag('')
              }}
            >
              <option value="">选择讲次</option>
              {catalog.math
                .filter((l) => !task.course_event_id || l.key === task.lesson?.key)
                .map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="题目分组">
            <select
              className={inputClass}
              value={group}
              onChange={(e) => {
                setGroup(e.target.value as ProblemGroup)
                setTag('')
              }}
            >
              {Object.entries(groups).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="题型 / 标签">
            <select className={inputClass} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">全部</option>
              {[...new Set(problems.filter((p) => p.group === group).flatMap((p) => p.tags))].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="题号或标题">
            <input
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          {query && (
            <button className={minorClass} onClick={() => setQuery('')}>
              清除搜索
            </button>
          )}
          {loading && <p role="status">正在加载题目…</p>}
          {error && (
            <div>
              <p role="alert">{error}</p>
              <button className={minorClass} onClick={() => setAttempt((a) => a + 1)}>
                重试加载题库
              </button>
            </div>
          )}
          {!loading && !error && !options.length && <p>当前筛选没有题目</p>}
          {options.map((p) => (
            <label key={p.stable_key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(p.stable_key)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [...prev, p.stable_key]
                      : prev.filter((k) => k !== p.stable_key),
                  )
                }
              />
              {p.displayId} · {p.title}
            </label>
          ))}
          <p className="text-sm text-slate-500">
            已选 {selected.length} 题；未选择仍保留预计时长。相同题目保留已完成记录。
          </p>
          <button
            disabled={busy || loading || !!error}
            className={minorClass}
            onClick={() =>
              void run(() =>
                api.save('tasks', {
                  id: task.id,
                  revision: task.revision,
                  progress_mode: 'items',
                  items: selected
                    .map((key) => {
                      const p = known[key]
                      return p
                        ? {
                            id: key,
                            label: `${p.displayId} · ${p.title}`,
                            done: false,
                            href: p.href,
                          }
                        : task.items.find((i) => i.id === key)!
                    })
                    .filter(Boolean),
                }),
              )
            }
          >
            保存所选题目
          </button>
          {itemSource !== 'class' && (
            <button
              disabled={busy}
              className={minorClass}
              onClick={() =>
                void run(() =>
                  api.save('tasks', {
                    id: task.id,
                    revision: task.revision,
                    selection_state: 'no_homework',
                  }),
                )
              }
            >
              本次无作业
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
