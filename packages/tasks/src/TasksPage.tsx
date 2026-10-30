'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { TaskCatalogAdapter, TasksSection } from './types'
import { useTaskData } from './useTaskData'
import { TasksContext, minorClass } from './components/shared'

function SectionLoading() {
  return (
    <p
      role="status"
      className="min-h-96 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500"
    >
      正在读取课表和任务…
    </p>
  )
}

const TaskList = dynamic(() => import('./components/TaskList'), { loading: SectionLoading })
const Timetable = dynamic(() => import('./components/Timetable'), { loading: SectionLoading })
const Schedule = dynamic(() => import('./components/Schedule'), { loading: SectionLoading })
const TaskPool = dynamic(() => import('./components/TaskPool'), { loading: SectionLoading })
const Materials = dynamic(() => import('./components/Materials'), { loading: SectionLoading })
const tabs: { key: TasksSection; href: string; label: string }[] = [
  { key: 'tasks', href: '/tasks', label: '风险与任务' },
  { key: 'schedule', href: '/tasks/schedule', label: '时间安排' },
  { key: 'timetable', href: '/tasks/timetable', label: '周课表' },
  { key: 'pool', href: '/tasks/pool', label: '任务池' },
  { key: 'materials', href: '/tasks/materials', label: '学习资料' },
]

function errorText(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  const translations: Record<string, string> = {
    stale_plan: '预测已过期，请重新计算后再采用',
    forecast_only_allocation: '预测任务尚未生成，请先生成任务后再固定安排',
    revision_conflict: '任务已变化，请刷新后再操作',
    invalid_recovery_target: '补做目标只能设为未完成逾期任务的未来时间，请刷新后重试',
    stale_task: '任务版本已变化，请刷新后重试',
    unknown_allocation: '所选片段已变化，请重新计算后选择',
    invalid_allocations: '请选择至少一个有效片段',
    invalid_allocation: '所选预测片段无效，请重新计算并选择',
    time_conflict: '与课程或其他任务时间冲突，请选择其他时段',
    outside_available_window: '时间块必须完整位于可用作业时间内',
    time_in_past: '请选择尚未过去的时间',
    course_not_finished: '课程尚未结束或已经停课',
    lesson_required: '请选择本次课程内容',
    task_not_open: '该任务已完成或取消，不能继续安排时间',
  }
  return translations[message] ?? message
}
export default function TasksPage({
  catalog,
  section = 'tasks',
}: {
  catalog: TaskCatalogAdapter
  section?: TasksSection
}) {
  const api = useTaskData()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      await work()
      return true
    } catch (error) {
      setMessage(errorText(error))
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  // Refresh station-only tasks while this page is visible; no background scheduler is required.
  const refreshRef = useRef(api.refresh)
  useEffect(() => {
    refreshRef.current = api.refresh
  }, [api.refresh])
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !lock.current)
        void refreshRef.current().catch((error) => setMessage(errorText(error)))
    }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return (
    <TasksContext.Provider value={{ api, catalog, run, busy, notify: setMessage }}>
      <main className="min-h-screen bg-slate-50 px-3 py-5 pb-32 text-slate-800 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="flex items-center justify-between gap-3">
            <div>
              <Link
                href="/"
                className="rounded text-sm text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                ← 首页
              </Link>
              <h1 className="mt-2 text-2xl font-extrabold">任务管理</h1>
            </div>
            <button
              disabled={busy || api.isLoading}
              className={`${minorClass} min-w-24 shrink-0`}
              onClick={() => void run(api.refresh)}
            >
              {api.isLoading ? '读取中…' : '刷新'}
            </button>
          </header>
          <nav
            aria-label="任务管理"
            className="sticky top-0 z-40 flex h-14 items-stretch gap-5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-1 sm:gap-7"
          >
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                scroll={false}
                aria-current={
                  (section === 'templates' ? 'pool' : section) === t.key ? 'page' : undefined
                }
                className={`flex shrink-0 items-center border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${(section === 'templates' ? 'pool' : section) === t.key ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="min-h-96 min-w-0 space-y-5">
            {!!(message || api.error) && (
              <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {message || errorText(api.error)}
              </div>
            )}
            {!api.user ? (
              <p>请先登录。</p>
            ) : api.isLoading ? (
              <SectionLoading />
            ) : api.error ? (
              <p className="text-sm">请先应用任务模块数据库迁移，再点击刷新重试。</p>
            ) : (
              <>
                {section === 'tasks' && <TaskList />}
                {section === 'timetable' && <Timetable />}
                {section === 'schedule' && <Schedule />}
                {(section === 'templates' || section === 'pool') && <TaskPool />}
                {section === 'materials' && <Materials />}
              </>
            )}
          </div>
        </div>
      </main>
    </TasksContext.Provider>
  )
}
