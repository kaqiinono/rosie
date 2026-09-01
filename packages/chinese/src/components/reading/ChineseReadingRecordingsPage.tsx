'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useAuth } from '@rosie/core'
import { PageBreadcrumb } from '@rosie/ui'
import { ChinesePageHeader, ChinesePageShell } from '../ChinesePageLayout'
import { useChineseContext } from '../../context/ChineseContext'
import { useChineseReadingRecordings } from '../../hooks/useChineseReadingRecordings'
import type { ChineseReadingRecording } from '../../utils/chinese-reading-recording-helpers'

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN')
}

function RecordingsSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4"
      aria-busy="true"
      aria-label="正在加载朗读录音"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-5 w-2/5 rounded-md bg-slate-200" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
            </div>
            <div className="h-7 w-14 rounded-full bg-rose-100" />
          </div>
          <div className="mt-3 h-10 w-full rounded-xl bg-amber-100/70" />
        </div>
      ))}
    </div>
  )
}

function RecordingRow({
  recording,
  signedUrl,
  active,
  onActivate,
  onPlay,
  onDelete,
}: {
  recording: ChineseReadingRecording
  signedUrl: string | undefined
  active: boolean
  onActivate: (recording: ChineseReadingRecording) => Promise<string | null>
  onPlay: (audio: HTMLAudioElement) => void
  onDelete: (id: string) => Promise<string | null>
}) {
  const [deleting, setDeleting] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleActivate = async () => {
    if (loadingAudio) return
    setLoadingAudio(true)
    setAudioError(false)
    const url = await onActivate(recording)
    if (!url) setAudioError(true)
    setLoadingAudio(false)
  }

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    const err = await onDelete(recording.id)
    if (err) setError(err)
    setDeleting(false)
  }

  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-slate-900">
            {recording.lessonTitle}
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {formatCreatedAt(recording.createdAt)}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatDuration(recording.durationMs)}
          </p>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className="shrink-0 cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          {deleting ? '删除中…' : '删除'}
        </button>
      </div>
      <div className="mt-auto pt-3">
        {active && signedUrl ? (
          <audio
            controls
            autoPlay
            src={signedUrl}
            className="w-full"
            preload="auto"
            onPlay={(event) => onPlay(event.currentTarget)}
            onError={() => setAudioError(true)}
          />
        ) : (
          <button
            type="button"
            disabled={loadingAudio}
            onClick={() => void handleActivate()}
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-full bg-slate-100 px-3 text-left text-slate-700 transition hover:bg-slate-200 disabled:cursor-wait"
            aria-label={`播放${recording.lessonTitle}`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-800 text-xs text-white">
              {loadingAudio ? '…' : '▶'}
            </span>
            <span className="h-1 flex-1 rounded-full bg-slate-300" />
            <span className="shrink-0 text-[11px] font-semibold tabular-nums">
              0:00 / {formatDuration(recording.durationMs)}
            </span>
          </button>
        )}
      </div>
      {audioError && (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">音频加载失败，请重试</p>
      )}
      {error && <p className="mt-2 text-[11px] font-semibold text-rose-600">{error}</p>}
    </li>
  )
}

export default function ChineseReadingRecordingsPage() {
  const { bookSlug } = useChineseContext()
  const { user } = useAuth()
  const { recordings, isLoading, deleteRecording, getSignedPlaybackUrl } =
    useChineseReadingRecordings(user)

  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(() => new Map())
  const signedUrlsRef = useRef<Map<string, string>>(new Map())
  const fetchingRef = useRef<Map<string, Promise<string | null>>>(new Map())
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const [activeStoragePath, setActiveStoragePath] = useState<string | null>(null)

  const bookRecordings = useMemo(
    () => recordings.filter((r) => r.bookSlug === bookSlug),
    [recordings, bookSlug],
  )

  const ensureSignedUrl = useCallback(
    (recording: ChineseReadingRecording): Promise<string | null> => {
      const path = recording.storagePath
      const cached = signedUrlsRef.current.get(path)
      if (cached) return Promise.resolve(cached)
      const pending = fetchingRef.current.get(path)
      if (pending) return pending

      const request = getSignedPlaybackUrl(path).then((url) => {
        fetchingRef.current.delete(path)
        if (!url) return null
        signedUrlsRef.current.set(path, url)
        setSignedUrls((prev) => {
          if (prev.get(path) === url) return prev
          const next = new Map(prev)
          next.set(path, url)
          return next
        })
        return url
      })
      fetchingRef.current.set(path, request)
      return request
    },
    [getSignedPlaybackUrl],
  )

  const handlePlay = useCallback((audio: HTMLAudioElement) => {
    if (activeAudioRef.current && activeAudioRef.current !== audio) {
      activeAudioRef.current.pause()
    }
    activeAudioRef.current = audio
  }, [])

  const activateRecording = useCallback(
    async (recording: ChineseReadingRecording): Promise<string | null> => {
      activeAudioRef.current?.pause()
      const url = await ensureSignedUrl(recording)
      if (url) setActiveStoragePath(recording.storagePath)
      return url
    },
    [ensureSignedUrl],
  )

  const handleDelete = useCallback(
    async (id: string): Promise<string | null> => {
      const recording = recordings.find((r) => r.id === id)
      const result = await deleteRecording(id)
      if (result.error) return result.error
      if (recording) {
        if (activeStoragePath === recording.storagePath) setActiveStoragePath(null)
        signedUrlsRef.current.delete(recording.storagePath)
        setSignedUrls((prev) => {
          if (!prev.has(recording.storagePath)) return prev
          const next = new Map(prev)
          next.delete(recording.storagePath)
          return next
        })
      }
      return null
    },
    [activeStoragePath, deleteRecording, recordings],
  )

  return (
    <ChinesePageShell
      width="wide"
      className="pt-5 pb-24 [padding-inline:0.75rem] sm:pt-7 sm:[padding-inline:1.5rem] lg:[padding-inline:2rem]"
    >
      <div className="mb-5 flex items-start sm:mb-6">
        <PageBreadcrumb variant="inline" />
      </div>
      <ChinesePageHeader
        className="mb-5 sm:mb-6"
        title={
          <span className="flex items-center gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-xl shadow-sm ring-1 ring-amber-200/70 sm:size-11"
              aria-hidden
            >
              🎙️
            </span>
            <span>我的朗读</span>
          </span>
        }
        description="集中回听本册课文朗读，记录每一次进步。"
        action={
          !isLoading && bookRecordings.length > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-700 shadow-sm">
              共 {bookRecordings.length} 条录音
            </span>
          ) : undefined
        }
      />

      {isLoading ? (
        <RecordingsSkeleton />
      ) : bookRecordings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">🎙️</div>
          <div className="font-bold text-slate-800">还没有朗读录音</div>
          <div className="mt-1 text-[12px] text-slate-500">读课文时可以录一段，会保存在这里。</div>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4">
          {bookRecordings.map((r) => (
            <RecordingRow
              key={r.id}
              recording={r}
              signedUrl={
                activeStoragePath === r.storagePath ? signedUrls.get(r.storagePath) : undefined
              }
              active={activeStoragePath === r.storagePath}
              onActivate={activateRecording}
              onPlay={handlePlay}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </ChinesePageShell>
  )
}
