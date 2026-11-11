'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { LinkButton } from '@rosie/ui'
import { createPortal } from 'react-dom'
import { supabase, useAuth, probeBaiduMedia, baiduResponseMessage, type Problem } from '@rosie/core'
import { useProblemVideoCatalog } from '../../hooks/useProblemVideoCatalog'
import { problemCardDisplayId } from '../../utils/problem-display-id'
import {
  lessonReplayKey,
  lessonKeyFromProblemId,
  orderedSummaryKeys,
} from '../../utils/lesson-registry'
import ProblemActionIcon from './ProblemActionIcon'
import { Button, IconButton } from '@rosie/ui/themes'

type Props = { problem: Pick<Problem, 'id' | 'displayId' | 'title'> }

function ReplayDialog({
  title,
  videoKey,
  onClose,
}: {
  title: string
  videoKey: string
  onClose: () => void
}) {
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
        if (!controller.signal.aborted)
          setError(message ?? '已能读取视频，请重试。若仍无法播放，请检查视频编码。')
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
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="border-border-light bg-surface text-text-primary shadow-sticker-lg fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border p-0 backdrop:bg-black/60"
    >
      <div className="border-border-light flex items-center justify-between gap-3 border-b px-4 py-2">
        <h2 id={titleId} className="min-w-0 text-sm font-bold">
          {title}
        </h2>
        <IconButton
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="关闭视频回放"
          variant="ghost"
          color="gray"
          size="3"
          className="w-11 shrink-0"
        >
          ×
        </IconButton>
      </div>
      {error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <p role="alert" className="text-text-secondary text-sm">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => {
              setPlaybackFailed(false)
              setReady(false)
              setError('')
              setAttempt((value) => value + 1)
            }}
            variant="solid"
            color="blue"
            size="3"
          >
            重试
          </Button>
        </div>
      ) : ready && !playbackFailed ? (
        <video
          key={attempt}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={title}
          src={streamUrl}
          onError={() => setPlaybackFailed(true)}
          className="aspect-video max-h-[70dvh] w-full bg-black"
        />
      ) : (
        <p
          role="status"
          className="text-text-secondary flex min-h-48 items-center justify-center p-6 text-sm"
        >
          正在打开回放…
        </p>
      )}
    </dialog>,
    document.body,
  )
}

export default function ProblemVideoReplay({ problem }: Props) {
  const { user } = useAuth()
  const { hasVideo } = useProblemVideoCatalog(user, lessonKeyFromProblemId(problem.id))
  if (!hasVideo(problem.id)) return null
  return (
    <ReplayButton
      videoKey={problem.id}
      label="回放"
      title={`${problemCardDisplayId(problem)} · ${problem.title} · 视频回放`}
    />
  )
}

export function LessonVideoReplay({ lessonKey }: { lessonKey: string }) {
  return (
    <ReplayButton
      videoKey={lessonReplayKey(lessonKey)}
      featured
      label="本讲回放"
      title={`第 ${lessonKey.split('-')[1]} 讲 · 完整回放`}
    />
  )
}

export function LessonSummaryVideos({ lessonKey }: { lessonKey: string }) {
  const { user } = useAuth()
  const { status, summaryNames } = useProblemVideoCatalog(user, lessonKey)
  const [playing, setPlaying] = useState<string | null>(null)
  const keys = orderedSummaryKeys(lessonKey, Object.keys(summaryNames))
  if (status !== 'ready' || !keys.length) return null

  return (
    <section aria-label="本讲总结视频" className="mt-3 w-full min-w-0">
      <h3 className="text-sm font-semibold">本讲总结视频</h3>
      <ol>
        {keys.map((key) => (
          <li key={key}>
            <LinkButton onClick={() => setPlaying(key)}>
              <ProblemActionIcon name="play" />
              <span className="text-left break-all">{summaryNames[key]}</span>
            </LinkButton>
          </li>
        ))}
      </ol>
      {playing && summaryNames[playing] && (
        <ReplayDialog
          key={playing}
          title={summaryNames[playing]}
          videoKey={playing}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  )
}

function ReplayButton({
  videoKey,
  label,
  title,
  featured = false,
}: {
  featured?: boolean
  videoKey: string
  label: string
  title: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size={featured ? '3' : '2'}
        radius="full"
        variant={featured ? 'solid' : 'soft'}
        color={featured ? 'indigo' : 'blue'}
        className="shrink-0 whitespace-nowrap"
        aria-label={`播放 ${title}`}
        aria-haspopup="dialog"
        title="播放视频回放"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <ProblemActionIcon name="play" />
        {label}
      </Button>
      {open && (
        <ReplayDialog
          key={videoKey}
          title={title}
          videoKey={videoKey}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
