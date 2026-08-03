'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@rosie/core'
import type { ChineseBookSlug } from '../../utils/chinese-books'
import { useChineseReadingRecordings } from '../../hooks/useChineseReadingRecordings'

export type PassageRecorderProps = {
  bookSlug: ChineseBookSlug
  lessonKey: string
  lessonTitle: string
}

type RecorderPhase = 'idle' | 'starting' | 'recording' | 'preview' | 'uploading' | 'saved'

const MAX_RECORD_MS = 10 * 60 * 1000

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) return 'audio/mp4;codecs=mp4a.40.2'
  return undefined
}

export default function PassageRecorder({ bookSlug, lessonKey, lessonTitle }: PassageRecorderProps) {
  const { user } = useAuth()
  const { uploadRecording } = useChineseReadingRecordings(user)

  const [hydrated, setHydrated] = useState(false)
  const [supported, setSupported] = useState(true)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [capNote, setCapNote] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [mimeType, setMimeType] = useState('audio/webm')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef(false)
  const previewUrlRef = useRef<string | null>(null)
  const mimeTypeRef = useRef('audio/webm')
  const mountedRef = useRef(true)
  const startInFlightRef = useRef(false)
  const savedTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined')
    setHydrated(true)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const resetToIdle = useCallback(() => {
    clearTimer()
    stopTracks()
    mediaRecorderRef.current = null
    chunksRef.current = []
    revokePreview()
    setBlob(null)
    setElapsedMs(0)
    setError(null)
    setCapNote(null)
    setPhase('idle')
  }, [clearTimer, revokePreview, stopTracks])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      if (savedTimeoutRef.current != null) {
        clearTimeout(savedTimeoutRef.current)
        savedTimeoutRef.current = null
      }
      const rec = mediaRecorderRef.current
      if (rec) {
        rec.onstop = null
        rec.onerror = null
        rec.ondataavailable = null
        if (rec.state !== 'inactive') {
          try {
            rec.stop()
          } catch {
            /* ignore */
          }
        }
      }
      stopTracks()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [clearTimer, stopTracks])

  const finishRecording = useCallback(
    (recorder: MediaRecorder) => {
      if (!mountedRef.current) return
      clearTimer()
      const duration = Math.max(0, Date.now() - startedAtRef.current)
      setElapsedMs(duration)

      const type = recorder.mimeType || mimeTypeRef.current || 'audio/webm'
      const nextBlob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      mediaRecorderRef.current = null
      stopTracks()

      revokePreview()
      const url = URL.createObjectURL(nextBlob)
      previewUrlRef.current = url
      setPreviewUrl(url)
      setBlob(nextBlob)
      mimeTypeRef.current = type
      setMimeType(type)
      setPhase('preview')
      if (autoStopRef.current) {
        setCapNote('最长录 10 分钟')
        autoStopRef.current = false
      }
    },
    [clearTimer, revokePreview, stopTracks],
  )

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    try {
      recorder.stop()
    } catch {
      setError('停止录音失败')
      resetToIdle()
    }
  }, [resetToIdle])

  const startRecording = useCallback(async () => {
    if (startInFlightRef.current) return
    startInFlightRef.current = true
    setPhase('starting')
    setError(null)
    setCapNote(null)
    if (typeof MediaRecorder === 'undefined') {
      setError('当前浏览器不支持录音')
      setPhase('idle')
      startInFlightRef.current = false
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('无法访问麦克风')
      setPhase('idle')
      startInFlightRef.current = false
      return
    }

    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      chunksRef.current = []

      const preferred = preferredMimeType()
      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      const type = recorder.mimeType || preferred || 'audio/webm'
      mimeTypeRef.current = type
      setMimeType(type)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onerror = () => {
        if (!mountedRef.current) return
        setError('录音出错')
        resetToIdle()
      }
      recorder.onstop = () => {
        finishRecording(recorder)
      }

      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setPhase('recording')
      recorder.start(250)

      clearTimer()
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current
        setElapsedMs(ms)
        if (ms >= MAX_RECORD_MS) {
          autoStopRef.current = true
          clearTimer()
          const rec = mediaRecorderRef.current
          if (rec && rec.state !== 'inactive') {
            try {
              rec.stop()
            } catch {
              /* ignore */
            }
          }
        }
      }, 200)
    } catch {
      stopTracks()
      if (mountedRef.current) {
        setError('无法使用麦克风，请检查权限后重试')
        setPhase('idle')
      }
    } finally {
      startInFlightRef.current = false
    }
  }, [clearTimer, finishRecording, resetToIdle, stopTracks])

  const discard = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  const upload = useCallback(async () => {
    if (!blob) return
    setError(null)
    setPhase('uploading')
    const { error: uploadErr } = await uploadRecording({
      bookSlug,
      lessonKey,
      lessonTitle,
      blob,
      mimeType: mimeType.split(';')[0]?.trim() || mimeType,
      durationMs: elapsedMs > 0 ? elapsedMs : null,
    })
    if (uploadErr) {
      if (mountedRef.current) {
        setError(uploadErr)
        setPhase('preview')
      }
      return
    }
    if (!mountedRef.current) return
    setPhase('saved')
    if (savedTimeoutRef.current != null) clearTimeout(savedTimeoutRef.current)
    savedTimeoutRef.current = window.setTimeout(() => {
      savedTimeoutRef.current = null
      if (mountedRef.current) resetToIdle()
    }, 1200)
  }, [
    blob,
    bookSlug,
    elapsedMs,
    lessonKey,
    lessonTitle,
    mimeType,
    resetToIdle,
    uploadRecording,
  ])

  if (hydrated && !supported) {
    return (
      <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 px-4 py-3">
        <p className="text-center text-xs font-semibold text-amber-900/50">当前浏览器不支持录音</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-amber-800">朗读录音（可选）</p>
        {(phase === 'recording' || phase === 'preview' || phase === 'uploading') && (
          <span className="tabular-nums text-[11px] font-bold text-amber-700">
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      {(phase === 'idle' || phase === 'starting') && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={!hydrated || phase === 'starting'}
            className="cursor-pointer rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {phase === 'starting' ? '准备中…' : '开始录音'}
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-rose-600">● 录音中…</p>
          <button
            type="button"
            onClick={stopRecording}
            className="cursor-pointer rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
          >
            停止
          </button>
        </div>
      )}

      {(phase === 'preview' || phase === 'uploading') && previewUrl && (
        <div className="flex flex-col gap-3">
          <audio controls src={previewUrl} className="w-full" preload="metadata" />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={phase === 'uploading'}
              onClick={() => void upload()}
              className="cursor-pointer rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
            >
              {phase === 'uploading' ? '上传中…' : '上传保存'}
            </button>
            <button
              type="button"
              disabled={phase === 'uploading'}
              onClick={discard}
              className="cursor-pointer rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-white disabled:opacity-60"
            >
              放弃
            </button>
          </div>
        </div>
      )}

      {phase === 'saved' && (
        <p className="text-center text-sm font-bold text-emerald-700">已保存</p>
      )}

      {capNote && (
        <p className="mt-2 text-center text-[11px] font-semibold text-amber-800">{capNote}</p>
      )}
      {error && (
        <p className="mt-2 text-center text-[11px] font-semibold text-rose-600">{error}</p>
      )}
    </div>
  )
}
