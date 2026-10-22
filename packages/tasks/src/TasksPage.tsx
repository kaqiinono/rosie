'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { TaskCatalogAdapter, TasksSection } from './types'
import { useTaskData } from './useTaskData'
import { TasksContext, minorClass } from './components/shared'

const TaskList = dynamic(() => import('./components/TaskList'))
const Timetable = dynamic(() => import('./components/Timetable'))
const Schedule = dynamic(() => import('./components/Schedule'))
const Templates = dynamic(() => import('./components/Templates'))
const Materials = dynamic(() => import('./components/Materials'))
const tabs: { key: TasksSection; href: string; label: string }[] = [ { key: 'tasks', href: '/tasks', label: '我的任务' }, { key: 'schedule', href: '/tasks/schedule', label: '时间安排' }, { key: 'timetable', href: '/tasks/timetable', label: '周课表' }, { key: 'templates', href: '/tasks/templates', label: '任务模板' }, { key: 'materials', href: '/tasks/materials', label: '学习资料' } ]

function errorText(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  const translations: Record<string, string> = { time_conflict: '与课程或其他任务时间冲突，请选择其他时段', outside_available_window: '时间块必须完整位于可用作业时间内', time_in_past: '请选择尚未过去的时间', course_not_finished: '课程尚未结束或已经停课', lesson_required: '请选择本次课程内容', task_not_open: '该任务已完成或取消，不能继续安排时间' }
  return translations[message] ?? message
}
export default function TasksPage({ catalog, section = 'tasks' }: { catalog: TaskCatalogAdapter; section?: TasksSection }) {
  const api = useTaskData()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    if (lock.current) return false
    lock.current = true; setBusy(true); setMessage('')
    try { await work(); return true } catch (error) { setMessage(errorText(error)); return false } finally { lock.current = false; setBusy(false) }
  }
  // Refresh station-only tasks while this page is visible; no background scheduler is required.
  const refreshRef = useRef(api.refresh)
  useEffect(() => { refreshRef.current = api.refresh }, [api.refresh])
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !lock.current) void refreshRef.current().catch(error => setMessage(errorText(error))) }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return <TasksContext.Provider value={{ api, catalog, run, busy, notify: setMessage }}><main className="min-h-screen bg-slate-50 px-4 py-6 pb-32 text-slate-800"><div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/" className="text-sm text-indigo-700">← 首页</Link><h1 className="mt-2 text-2xl font-extrabold">任务管理</h1></div><button disabled={busy || api.isLoading} className={minorClass} onClick={() => void run(api.refresh)}>刷新</button></header>
    <nav aria-label="任务管理" className="flex flex-wrap gap-2">{tabs.map(t => <Link key={t.key} href={t.href} aria-current={section === t.key ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${section === t.key ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{t.label}</Link>)}</nav>
    {(message || api.error) && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message || errorText(api.error)}</div>}
    {!api.user ? <p>请先登录。</p> : api.isLoading ? <p role="status">正在读取课表和任务…</p> : api.error ? <p className="text-sm">请先应用任务模块数据库迁移，再点击刷新重试。</p> : <>
      {section === 'tasks' && <TaskList />}{section === 'timetable' && <Timetable />}{section === 'schedule' && <Schedule />}{section === 'templates' && <Templates />}{section === 'materials' && <Materials />}
    </>}
  </div></main></TasksContext.Provider>
}
