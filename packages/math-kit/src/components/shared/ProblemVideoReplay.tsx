'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase, useAuth, type Problem } from '@rosie/core'
import { useProblemVideoCatalog } from '../../hooks/useProblemVideoCatalog'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import { problemVideoKey } from '../../utils/problem-video'
import { lessonKeyFromProblemId } from '../../utils/lesson-registry'
import ProblemActionIcon from './ProblemActionIcon'

type Props = { problem: Pick<Problem, 'id' | 'displayId' | 'title'> }

function ReplayDialog({ problem, videoKey, onClose }: Props & { videoKey: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setReady(false)
    setError('')
    void (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (controller.signal.aborted) return
        if (sessionError || !data.session) {
          setError('登录已过期，请重新登录后播放。')
          return
        }
        const response = await fetch('/api/baidu/video/session', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        })
        if (controller.signal.aborted) return
        if (!response.ok) {
          setError(response.status === 401 ? '登录已过期，请重新登录后播放。' : '暂时无法打开回放，请稍后重试。')
          return
        }
        setReady(true)
      } catch {
        if (!controller.signal.aborted) setError('暂时无法打开回放，请检查网络后重试。')
      }
    })()
    return () => controller.abort()
  }, [attempt])

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-border-light bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-light px-4 py-2">
        <h2 id={titleId} className="min-w-0 text-sm font-bold">{problemCardDisplayId(problem)} · {problem.title} · 视频回放</h2>
        <button type="button" autoFocus onClick={onClose} aria-label="关闭视频回放" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-surface-dim focus-visible:outline-2 focus-visible:outline-app-blue">×</button>
      </div>
      {error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <p role="alert" className="text-sm text-text-secondary">{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-app-blue">重试</button>
        </div>
      ) : ready ? (
        <video
          key={attempt}
          controls autoPlay playsInline preload="metadata"
          aria-label={`${problemCardDisplayId(problem)} 视频回放`}
          src={`/api/baidu/video/${encodeURIComponent(videoKey)}`}
          onError={() => setError('视频暂时无法播放，请确认网盘中已上传对应视频、百度授权有效，并检查网络。')}
          className="aspect-video max-h-[70dvh] w-full bg-black"
        />
      ) : <p role="status" className="flex min-h-48 items-center justify-center p-6 text-sm text-text-secondary">正在打开回放…</p>}
    </dialog>,
    document.body,
  )
}

export default function ProblemVideoReplay({ problem }: Props) {
  const { user } = useAuth()
  const { hasVideo } = useProblemVideoCatalog(user, lessonKeyFromProblemId(problem.id))
  const [open, setOpen] = useState(false)
  const videoKey = problemVideoKey(problem)
  if (!videoKey || !hasVideo(videoKey)) return null

  return (
    <>
      <button
        type="button"
        aria-label={`播放 ${problemCardDisplayId(problem)} 视频回放`}
        aria-haspopup="dialog"
        title="播放视频回放"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true) }}
        className="inline-flex h-[30px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-app-blue-dark transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue motion-reduce:transition-none"
      >
        <ProblemActionIcon name="play" />
        回放
      </button>
      {open && <ReplayDialog problem={problem} videoKey={videoKey} onClose={() => setOpen(false)} />}
    </>
  )
}
