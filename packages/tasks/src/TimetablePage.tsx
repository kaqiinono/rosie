'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTimetableData } from './useTimetableData'
import CourseReminders from './components/timetable/CourseReminders'
import Timetable from './components/Timetable'
import { TimetableContext, minorClass } from './components/shared'

export default function TimetablePage() {
  const api = useTimetableData()
  const { error, user, isLoading, refresh } = api
  const [message, notify] = useState('')
  const [refreshError, setRefreshError] = useState('')
  return <main className="min-h-screen bg-slate-50 px-3 py-5 pb-32 text-slate-800 sm:px-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center justify-between">
        <div><Link href="/" className="text-sm text-emerald-800 hover:underline">← 首页</Link>
          <h1 className="mt-2 text-2xl font-extrabold">课程表</h1></div>
        <button className={minorClass} disabled={isLoading || !user} onClick={async () => {
          setRefreshError('')
          try { await refresh() } catch { setRefreshError('刷新失败，请重试。') }
        }}>刷新</button>
      </header>
      {message && <p role="status">{message}</p>}
      {refreshError && <p role="alert">{refreshError}</p>}
      {!user ? <p>请先登录。</p> : isLoading ? <p role="status">正在读取课表…</p> :
        error ? <p role="alert">课表读取失败，请点击刷新重试。</p> : <TimetableContext.Provider value={{ api, notify }}><CourseReminders data={api.data} /><Timetable /></TimetableContext.Provider>}
    </div>
  </main>
}
