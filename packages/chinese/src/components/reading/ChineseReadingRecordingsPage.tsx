'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useChineseContext } from '../../context/ChineseContext'
import { useChineseReadingRecordings } from '../../hooks/useChineseReadingRecordings'
import type { ChineseReadingRecording } from '../../utils/chinese-reading-recording-helpers'
import { chineseRoute } from '../../utils/chinese-routes'

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

function RecordingRow({
  recording,
  signedUrl,
  onEnsureSignedUrl,
  onDelete,
}: {
  recording: ChineseReadingRecording
  signedUrl: string | undefined
  onEnsureSignedUrl: (recording: ChineseReadingRecording) => void
  onDelete: (id: string) => Promise<string | null>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onEnsureSignedUrl(recording)
  }, [onEnsureSignedUrl, recording])

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    const err = await onDelete(recording.id)
    if (err) setError(err)
    setDeleting(false)
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      {signedUrl ? (
        <audio
          controls
          src={signedUrl}
          className="mt-3 w-full"
          preload="metadata"
          onPlay={() => onEnsureSignedUrl(recording)}
        />
      ) : (
        <button
          type="button"
          onClick={() => onEnsureSignedUrl(recording)}
          className="mt-3 w-full cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
        >
          加载播放…
        </button>
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
  const signedUrlsRef = useRef(signedUrls)
  useEffect(() => {
    signedUrlsRef.current = signedUrls
  }, [signedUrls])
  const fetchingRef = useRef<Set<string>>(new Set())

  const bookRecordings = useMemo(
    () => recordings.filter((r) => r.bookSlug === bookSlug),
    [recordings, bookSlug],
  )

  const ensureSignedUrl = useCallback(
    (recording: ChineseReadingRecording) => {
      const path = recording.storagePath
      if (signedUrlsRef.current.has(path) || fetchingRef.current.has(path)) return
      fetchingRef.current.add(path)
      void getSignedPlaybackUrl(path).then((url) => {
        fetchingRef.current.delete(path)
        if (!url) return
        setSignedUrls((prev) => {
          if (prev.get(path) === url) return prev
          const next = new Map(prev)
          next.set(path, url)
          return next
        })
      })
    },
    [getSignedPlaybackUrl],
  )

  const handleDelete = useCallback(
    async (id: string): Promise<string | null> => {
      const recording = recordings.find((r) => r.id === id)
      const result = await deleteRecording(id)
      if (result.error) return result.error
      if (recording) {
        setSignedUrls((prev) => {
          if (!prev.has(recording.storagePath)) return prev
          const next = new Map(prev)
          next.delete(recording.storagePath)
          return next
        })
      }
      return null
    },
    [deleteRecording, recordings],
  )

  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 pb-24">
      <header className="mb-4">
        <div className="mb-2">
          <Link
            href={chineseRoute(bookSlug, 'reading')}
            className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 no-underline ring-1 ring-amber-200 transition hover:-translate-x-0.5"
          >
            <span className="text-[14px] leading-none">←</span>
            <span>返回阅读</span>
          </Link>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">🎙️ 我的朗读</h1>
        <p className="mt-0.5 text-sm text-amber-900/50">本册课文朗读录音</p>
      </header>

      {isLoading ? (
        <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
      ) : bookRecordings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">🎙️</div>
          <div className="font-bold text-slate-800">还没有朗读录音</div>
          <div className="mt-1 text-[12px] text-slate-500">读课文时可以录一段，会保存在这里。</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookRecordings.map((r) => (
            <RecordingRow
              key={r.id}
              recording={r}
              signedUrl={signedUrls.get(r.storagePath)}
              onEnsureSignedUrl={ensureSignedUrl}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
