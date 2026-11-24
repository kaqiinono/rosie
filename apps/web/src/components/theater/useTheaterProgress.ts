'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@rosie/core'

interface Progress {
  position_ms: number
  revision: number
}

export function useTheaterProgress(userId: string, filmId: string) {
  const state = useRef({ revision: 0, savedMs: 0, pending: null as number | null, writing: false, blocked: true })
  const life = useRef<AbortController | null>(null)
  const [resume, setResume] = useState<Progress | null>(null)
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState(true)

  const reload = useCallback(async () => {
    const controller = life.current
    if (!controller || controller.signal.aborted || state.current.writing) return
    state.current.blocked = true
    state.current.pending = null
    setReading(true)
    setMessage('')
    try {
      const { data, error } = await supabase.from('theater_progress').select('position_ms,revision')
        .eq('film_id', filmId).eq('user_id', userId).abortSignal(controller.signal).maybeSingle()
      if (controller.signal.aborted) return
      if (error) throw error
      const progress: Progress = data ?? { position_ms: 0, revision: 0 }
      state.current.revision = progress.revision
      state.current.savedMs = progress.position_ms
      state.current.blocked = false
      setResume(progress)
    } catch {
      if (!controller.signal.aborted) setMessage('暂时无法读取云端进度。')
    } finally {
      if (!controller.signal.aborted) setReading(false)
    }
  }, [filmId, userId])

  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    void reload()
    return () => {
      controller.abort()
      if (life.current === controller) life.current = null
    }
  }, [reload])

  const save = useCallback(async (positionMs: number) => {
    const current = state.current
    const controller = life.current
    if (!controller || controller.signal.aborted || current.blocked || !Number.isFinite(positionMs)) return
    current.pending = Math.max(0, Math.min(86_400_000, Math.round(positionMs)))
    if (current.writing) return
    current.writing = true
    try {
      while (current.pending !== null && !controller.signal.aborted) {
        const next = current.pending
        current.pending = null
        if (Math.abs(next - current.savedMs) < 500) continue
        const { data: session } = await supabase.auth.getSession()
        if (controller.signal.aborted || session.session?.user.id !== userId) return
        const { data, error } = await supabase.rpc('save_theater_progress', {
          p_film_id: filmId, p_position_ms: next, p_revision: current.revision,
        })
        if (controller.signal.aborted) return
        if (error) throw error
        if (typeof data !== 'number') {
          current.blocked = true
          current.pending = null
          setMessage('另一台设备更新了进度。读取云端进度后可继续同步。')
          return
        }
        current.revision = data
        current.savedMs = next
        setMessage('')
      }
    } catch {
      if (!controller.signal.aborted) setMessage('暂时无法保存进度。播放时会再次尝试，离开前可重试。')
    } finally {
      current.writing = false
    }
  }, [filmId, userId])

  return { resume, message, reading, reload, save }
}
