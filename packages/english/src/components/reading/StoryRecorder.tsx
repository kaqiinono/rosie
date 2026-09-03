'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { useStoryRecordings } from '../../hooks/useStoryRecordings'
import type { StoryRecordingScope } from '../../utils/story-recording-types'

type Props = {
  contentKey: string
  scope: StoryRecordingScope
  title: string
  downloadName: string
  heading?: ReactNode
}

type Phase = 'idle' | 'starting' | 'recording' | 'paused' | 'preview' | 'saving'
const MAX_RECORDING_MS = 60 * 60 * 1000

function formatMs(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
}

function recordingExtension(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('mp4')) return 'm4a'
  return 'webm'
}

export default function StoryRecorder({
  contentKey,
  scope,
  title,
  downloadName,
  heading,
}: Props) {
  const { user } = useAuth()
  const { recordingsFor, saveRecording, deleteRecording, getSignedUrl } = useStoryRecordings(user)
  const recordings = recordingsFor(contentKey, scope)
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [playbackId, setPlaybackId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const pausedTotalRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setBlob(null)
  }, [previewUrl])

  useEffect(
    () => () => {
      stopTimer()
      stopTracks()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl, stopTimer, stopTracks],
  )

  const start = useCallback(async () => {
    setError(null)
    setPhase('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('当前浏览器不支持录音')
      }
      resetPreview()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const mimeType = preferredMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      pausedTotalRef.current = 0
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stopTimer()
        stopTracks()
        const nextBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(nextBlob)
        setBlob(nextBlob)
        setPreviewUrl(url)
        setPhase('preview')
      }
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      recorder.start(250)
      setPhase('recording')
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current - pausedTotalRef.current
        setElapsedMs(elapsed)
        if (elapsed >= MAX_RECORDING_MS) recorderRef.current?.stop()
      }, 250)
    } catch (cause) {
      stopTracks()
      setError(cause instanceof Error ? cause.message : '无法使用麦克风，请检查权限')
      setPhase('idle')
    }
  }, [resetPreview, stopTimer, stopTracks])

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      pausedAtRef.current = Date.now()
      setPhase('paused')
    } else if (recorder.state === 'paused') {
      pausedTotalRef.current += Date.now() - pausedAtRef.current
      recorder.resume()
      setPhase('recording')
    }
  }, [])

  const save = useCallback(async () => {
    if (!blob) return
    setPhase('saving')
    setError(null)
    const result = await saveRecording({
      contentKey,
      scope,
      title,
      blob,
      mimeType: blob.type || 'audio/webm',
      durationMs: elapsedMs,
    })
    if (result.error) {
      setError(result.error)
      setPhase('preview')
    } else {
      resetPreview()
      setPhase('idle')
    }
  }, [blob, contentKey, elapsedMs, resetPreview, saveRecording, scope, title])

  const loadPlayback = useCallback(
    async (recording: (typeof recordings)[number]) => {
      setPlaybackId(recording.id)
      setPlaybackUrl(await getSignedUrl(recording.storagePath))
    },
    [getSignedUrl],
  )

  const download = useCallback(async (recording: (typeof recordings)[number], index: number) => {
    const url = await getSignedUrl(recording.storagePath)
    if (!url) return setError('暂时无法下载录音')
    const response = await fetch(url)
    if (!response.ok) return setError('下载录音失败')
    const objectUrl = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    const extension = recordingExtension(recording.mimeType)
    anchor.download = `${downloadName.replace(/\.[^.]+$/, '')}-片段-${index + 1}.${extension}`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }, [downloadName, getSignedUrl])

  return (
    <section className="mt-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {heading ?? <h2 className="font-fredoka font-bold text-amber-950">朗读录音</h2>}
        <div className="flex shrink-0 items-center gap-2">
          {recordings.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
              {recordings.length} 段
          </span>
          )}
          {(phase === 'idle' || phase === 'starting') && (
            <button
              type="button"
              disabled={phase === 'starting'}
              onClick={() => void start()}
              className="min-h-11 rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-50"
            >
              {phase === 'starting' ? '准备麦克风…' : '录制新片段'}
            </button>
          )}
        </div>
      </div>
      {(phase === 'recording' || phase === 'paused') && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-rose-600 tabular-nums">● {formatMs(elapsedMs)}</span>
          <button
            type="button"
            onClick={togglePause}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-amber-300"
          >
            {phase === 'paused' ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            onClick={() => recorderRef.current?.stop()}
            className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-bold text-white"
          >
            停止
          </button>
        </div>
      )}
      {playbackUrl && (
        <audio controls autoPlay src={playbackUrl} preload="metadata" className="mt-3 w-full" />
      )}
      {recordings.length > 0 && phase !== 'recording' && phase !== 'paused' && (
        <div className="mt-4 space-y-2 border-t border-amber-200/80 pt-3">
          <p className="text-xs font-bold text-amber-900">已保存的朗读片段</p>
          {recordings.map((recording, index) => (
            <div
              key={recording.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-white/75 px-3 py-2 ring-1 ring-amber-200"
            >
              <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">
                片段 {recordings.length - index} · {formatMs(recording.durationMs ?? 0)}
              </span>
              <button
                type="button"
                onClick={() => void loadPlayback(recording)}
                className="min-h-10 rounded-full px-3 text-sm font-bold text-amber-900 ring-1 ring-amber-300"
              >
                {playbackId === recording.id ? '正在播放' : '播放'}
              </button>
              <button
                type="button"
                onClick={() => void download(recording, recordings.length - index - 1)}
                className="min-h-10 rounded-full px-3 text-sm font-bold text-amber-900 ring-1 ring-amber-300"
              >
                下载
              </button>
              <button
                type="button"
                onClick={() => void deleteRecording(recording)}
                className="min-h-10 rounded-full px-3 text-sm font-bold text-rose-600"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
      {(phase === 'preview' || phase === 'saving') && previewUrl && (
        <div className="mt-3 space-y-3">
          <audio controls src={previewUrl} preload="metadata" className="w-full" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={() => void save()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {phase === 'saving' ? '压缩并保存中…' : '保存录音'}
            </button>
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={resetPreview}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-amber-300"
            >
              放弃
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-rose-600">
          {error}
        </p>
      )}
    </section>
  )
}
