'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { LinkButton } from '@rosie/ui'
import { createPortal } from 'react-dom'
import { supabase, useAuth, probeBaiduMedia, baiduResponseMessage, type Problem } from '@rosie/core'
import { useProblemVideoCatalog } from '../../hooks/useProblemVideoCatalog'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import { lessonReplayKey, lessonKeyFromProblemId, orderedSummaryKeys } from '../../utils/lesson-registry'
import ProblemActionIcon from './ProblemActionIcon'

type Props = { problem: Pick<Problem, 'id' | 'displayId' | 'title'> }

function ReplayDialog({ title, videoKey, onClose }: { title: string; videoKey: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const streamUrl = `/api/baidu/video/${encodeURIComponent(videoKey)}`

  useEffect(() => {
    if (!playbackFailed) return
    const controller = new AbortController()
    // Native video errors hide the HTTP status. Probe one byte only after a failure.
    void (async () => {
      try {
        const message = await probeBaiduMedia(streamUrl, controller.signal)
        if (!controller.signal.aborted) setError(message ?? '已能读取视频，请重试。若仍无法播放，请检查视频编码。')
      } catch {
        if (!controller.signal.aborted) setError('读取回放失败，请检查网络后重试。')
      }
    })()
    return () => controller.abort()
  }, [playbackFailed, streamUrl])

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
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        })
        if (controller.signal.aborted) return
        if (!response.ok) {
          const message = await baiduResponseMessage(response, '暂时无法打开回放，请稍后重试。')
          if (!controller.signal.aborted) setError(message)
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
        <h2 id={titleId} className="min-w-0 text-sm font-bold">{title}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label="关闭视频回放" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-surface-dim focus-visible:outline-2 focus-visible:outline-app-blue">×</button>
      </div>
      {error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <p role="alert" className="text-sm text-text-secondary">{error}</p>
          <button type="button" onClick={() => { setPlaybackFailed(false); setReady(false); setError(''); setAttempt((value) => value + 1) }} className="min-h-11 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-app-blue">重试</button>
        </div>
      ) : ready && !playbackFailed ? (
        <video
          key={attempt}
          controls autoPlay playsInline preload="metadata"
          aria-label={title}
          src={streamUrl}
          onError={() => setPlaybackFailed(true)}
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
  if (!hasVideo(problem.id)) return null
  return <ReplayButton videoKey={problem.id} label="回放" title={`${problemCardDisplayId(problem)} · ${problem.title} · 视频回放`} />
}

export function LessonVideoReplay({ lessonKey }: { lessonKey: string }) {
  return <ReplayButton videoKey={lessonReplayKey(lessonKey)} featured label="本讲回放" title={`第 ${lessonKey.split('-')[1]} 讲 · 完整回放`} />
}

export function LessonSummaryVideos({ lessonKey }: { lessonKey: string }) {
  const { user } = useAuth()
  const { status, summaryNames } = useProblemVideoCatalog(user, lessonKey)
  const [playing, setPlaying] = useState<string | null>(null)
  const keys = orderedSummaryKeys(lessonKey, Object.keys(summaryNames))
  if (status !== 'ready' || !keys.length) return null

  return <section aria-label="本讲总结视频" className="mt-3 w-full min-w-0">
    <h3 className="text-sm font-semibold">本讲总结视频</h3>
    <ol>
      {keys.map(key => <li key={key}>
        <LinkButton onClick={() => setPlaying(key)}>
          <ProblemActionIcon name="play" />
          <span className="break-all text-left">{summaryNames[key]}</span>
        </LinkButton>
      </li>)}
    </ol>
    {playing && summaryNames[playing] && (
      <ReplayDialog key={playing} title={summaryNames[playing]} videoKey={playing} onClose={() => setPlaying(null)} />
    )}
  </section>
}

function ReplayButton({ videoKey, label, title, featured = false }: { featured?: boolean; videoKey: string; label: string; title: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={`播放 ${title}`}
        aria-haspopup="dialog"
        title="播放视频回放"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true) }}
        className={featured
          ? "inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          : "inline-flex h-[30px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-app-blue-dark transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue motion-reduce:transition-none"}
      >
        <ProblemActionIcon name="play" />
        {label}
      </button>
      {open && <ReplayDialog key={videoKey} title={title} videoKey={videoKey} onClose={() => setOpen(false)} />}
    </>
  )
}
