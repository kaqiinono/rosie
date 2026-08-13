'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { compressAudioToMp3 } from '@rosie/player'
import { supabase } from '@rosie/core'

type AiVoiceInputProps = {
  onTranscribed: (text: string) => void
  disabled?: boolean
  compact?: boolean
}

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

const MAX_RECORD_MS = 60_000

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return undefined
}

export default function AiVoiceInput({
  onTranscribed,
  disabled,
  compact = false,
}: AiVoiceInputProps) {
  const [supported, setSupported] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined')
  }, [])

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => cleanup, [cleanup])

  const uploadForStt = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase('transcribing')
      const file = new File([blob], 'voice.webm', { type: mimeType })
      const compressed = await compressAudioToMp3(file)
      const uploadFile =
        compressed.compressed && compressed.blob.size > 0
          ? new File([compressed.blob], compressed.filename, { type: compressed.contentType })
          : file

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('未登录')

      const form = new FormData()
      form.append('audio', uploadFile)

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message ?? '语音识别失败')
      }

      const json = (await res.json()) as { text?: string }
      if (!json.text) throw new Error('没听清，再试一次')
      onTranscribed(json.text)
      setPhase('idle')
      setError(null)
    },
    [onTranscribed],
  )

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.onstop = async () => {
      const chunks = chunksRef.current
      cleanup()
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) throw new Error('录音太短了')
        await uploadForStt(blob, recorder.mimeType || 'audio/webm')
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : '语音识别失败')
      }
    }

    recorder.stop()
  }, [cleanup, uploadForStt])

  const startRecording = useCallback(async () => {
    if (disabled || phase === 'recording' || phase === 'transcribing') return
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = preferredMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // Ask the browser to flush audio regularly. Some WebKit implementations
      // can otherwise emit an empty final chunk when stop() is called.
      recorder.start(250)
      setPhase('recording')
      stopTimerRef.current = setTimeout(() => {
        void stopRecording()
      }, MAX_RECORD_MS)
    } catch {
      setPhase('error')
      setError('无法使用麦克风，请检查权限')
      cleanup()
    }
  }, [cleanup, disabled, phase, stopRecording])

  if (!supported) return null

  const phaseLabel =
    phase === 'recording'
      ? '点击结束'
      : phase === 'transcribing'
        ? '正在识别…'
        : '点击说话'

  const toggleRecording = () => {
    if (phase === 'recording') {
      void stopRecording()
      return
    }
    void startRecording()
  }

  if (compact) {
    return (
      <div className="relative shrink-0">
        {(phase !== 'idle' || error) && (
          <div
            role="status"
            className={`absolute bottom-[calc(100%+0.75rem)] left-0 z-10 w-max max-w-52 rounded-xl px-3 py-2 text-xs font-semibold shadow-lg ring-1 ${
              error
                ? 'bg-rose-50 text-rose-600 ring-rose-100'
                : 'bg-slate-900 text-white ring-slate-800'
            }`}
          >
            {error ?? phaseLabel}
          </div>
        )}
        <button
          type="button"
          disabled={disabled || phase === 'transcribing'}
          onClick={toggleRecording}
          className={`grid size-10 place-items-center rounded-xl text-lg transition ${
            phase === 'recording'
              ? 'scale-105 bg-rose-500 text-white ring-4 ring-rose-100'
              : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
          } disabled:opacity-50`}
          aria-label={phase === 'recording' ? '结束录音' : '开始录音'}
          aria-pressed={phase === 'recording'}
          title={phaseLabel}
        >
          {phase === 'transcribing' ? '…' : '🎤'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || phase === 'transcribing'}
        onClick={toggleRecording}
        className={`flex h-14 w-14 items-center justify-center rounded-[20px] text-xl shadow-md transition ${
          phase === 'recording'
            ? 'scale-105 bg-rose-500 text-white ring-4 ring-rose-100'
            : 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white hover:-translate-y-0.5'
        } disabled:opacity-50`}
        aria-label={phase === 'recording' ? '结束录音' : '开始录音'}
        aria-pressed={phase === 'recording'}
      >
        🎤
      </button>
      <p className="text-xs font-medium text-slate-500">{phaseLabel}</p>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
