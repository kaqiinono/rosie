'use client'

import dynamic from 'next/dynamic'
import { useEffect, useId, useRef, useState } from 'react'
import { isAdminUser, useAuth, SOURCE_LABELS } from '@rosie/core'
import { SelectControl } from '@rosie/ui'
import { LESSONS, lessonByKey, gradesInOrderFromRegistry } from '@rosie/math-kit/utils/lesson-registry'
import { replaceProblemVideoCatalog, useProblemVideoCatalog } from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import { parseProblemVideoCatalog } from '@rosie/math-kit/utils/problem-video-catalog'
import { requestBaiduVideoData, videoSyncTime, VIDEO_SECONDARY_BUTTON } from './baidu-video-client'

const MathVideoReport = dynamic(() => import('./MathVideoReport'), {
  loading: () => <p role="status" className="py-6 text-sm text-text-secondary">正在打开匹配报告…</p>,
})
const GRADE_OPTIONS = gradesInOrderFromRegistry().map((grade) => ({ value: String(grade), label: `${grade}年级` }))
const DEFAULT_LESSON_KEY = [...LESSONS].sort((a, b) => b.grade - a.grade || b.seq - a.seq)[0]?.lessonKey ?? ''
const REPORT_SOURCES = ['lesson', 'homework', 'pretest', 'supplement', 'workbook'] as const

export default function BaiduMathVideoManager() {
  const { user } = useAuth()
  const admin = isAdminUser(user)
  const [lessonKey, setLessonKey] = useState(DEFAULT_LESSON_KEY)
  const grade = lessonByKey(lessonKey)?.grade
  const lessonOptions = LESSONS.filter((lesson) => lesson.grade === grade).map((lesson) => ({ value: lesson.lessonKey, label: `第 ${lesson.seq} 讲` }))
  const catalog = useProblemVideoCatalog(admin ? user : null, lessonKey)
  const [pending, setPending] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [sources, setSources] = useState<string[]>(['lesson'])
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const syncController = useRef<AbortController | null>(null)
  const reportId = useId()

  useEffect(() => () => { syncController.current?.abort() }, [])

  function selectLesson(next: string) {
    if (syncController.current) return
    setLessonKey(next)
    setMessage('')
    setFailed(false)
  }

  async function sync(force = false) {
    if (!user || !admin || syncController.current) return
    const controller = new AbortController()
    syncController.current = controller
    setPending(true)
    setMessage('')
    setFailed(false)
    try {
      const next = parseProblemVideoCatalog(await requestBaiduVideoData('sync', user.id, lessonKey, controller.signal, force), lessonKey)
      if (controller.signal.aborted) return
      replaceProblemVideoCatalog(user.id, next)
      setMessage(`本讲清单已更新，共 ${next.keys.length} 个符合命名规则的视频。`)
    } catch (error) {
      if (controller.signal.aborted) return
      setFailed(true)
      setMessage(error instanceof Error && error.name === 'Error' ? error.message
        : '未能确认同步结果，请刷新页面查看同步时间；需要时可再次手动同步。')
    } finally {
      if (!controller.signal.aborted) setPending(false)
      if (syncController.current === controller) syncController.current = null
    }
  }

  if (!admin || !user) return null
  return (
    <div className="mt-4 border-t border-border-light pt-4">
      <h4 className="text-base font-bold text-text-primary">数学视频回放</h4>
      <p className="mt-1 text-sm text-text-secondary">选择年级和讲次，已同步的清单直接复用。上传或删除视频后，点击「重新同步本讲」。只有匹配到视频的题目才显示「回放」。</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SelectControl value={String(grade ?? '')} options={GRADE_OPTIONS} disabled={pending} ariaLabel="选择同步年级" label="年级"
          onValueChange={(value) => { const first = LESSONS.find((lesson) => String(lesson.grade) === value); if (first) selectLesson(first.lessonKey) }} />
        <SelectControl value={lessonKey} options={lessonOptions} disabled={pending} ariaLabel="选择同步讲次" label="讲次" onValueChange={selectLesson} />
      </div>
      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-text-primary">题目来源（可多选）</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {REPORT_SOURCES.map((source) => <label key={source} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border-light bg-surface px-3 text-sm text-text-primary">
            <input type="checkbox" checked={sources.includes(source)} onChange={(event) => {
              const checked = event.target.checked
              setSources((previous) => checked ? [...previous, source] : previous.filter((value) => value !== source))
            }} className="h-4 w-4 accent-app-blue" />
            {SOURCE_LABELS[source]}
          </label>)}
        </div>
        <p className="mt-1 text-xs text-text-secondary">仅筛选题目视图；视频始终对照本讲全部题目，切换来源不会重新同步。</p>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void sync()} disabled={pending || catalog.status === 'ready' || catalog.status === 'loading' || !lessonKey} aria-busy={pending}
          className="inline-flex min-h-11 min-w-36 items-center justify-center rounded-xl bg-app-blue-dark px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue disabled:cursor-wait disabled:opacity-60">
          {pending ? '正在同步本讲…' : catalog.status === 'ready' ? '已同步，复用清单' : '同步本讲'}
        </button>
        {catalog.status === 'ready' && <button type="button" onClick={() => void sync(true)} disabled={pending} className={VIDEO_SECONDARY_BUTTON}>重新同步本讲</button>}
        <button type="button" onClick={() => setShowReport((value) => !value)} aria-expanded={showReport} aria-controls={reportId} className={VIDEO_SECONDARY_BUTTON}>
          {showReport ? '收起匹配报告' : '查看匹配报告'}
        </button>
        {catalog.status === 'error' && <button type="button" onClick={() => { void catalog.retry().catch(() => {}) }} className={VIDEO_SECONDARY_BUTTON}>重新读取清单</button>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">
        {catalog.status === 'loading' ? '正在读取已保存清单…'
          : catalog.status === 'error' ? '清单读取失败，请重试；未将视频判定为缺失。'
          : catalog.syncedAt ? `本讲最近成功同步：${videoSyncTime(catalog.syncedAt)}（北京时间） · ${catalog.count} 个视频`
          : '本讲尚未同步，题目暂不显示回放按钮。'}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className={`mt-2 min-h-5 text-sm ${failed ? 'text-red-700' : 'text-app-green-dark'}`}>{message}</p>
      <div id={reportId} hidden={!showReport}>
        {showReport && <MathVideoReport key={`${user.id}:${lessonKey}`} userId={user.id} lessonKey={lessonKey} sources={sources} revision={catalog.syncedAt} />}
      </div>
    </div>
  )
}
