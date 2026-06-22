'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { FlipbookProgress } from '@/utils/flipbook-types'

interface RawProgressRow {
  book_id: string
  last_page: number
  audio_position_sec: number
  updated_at: string
}

function rowToProgress(row: RawProgressRow): FlipbookProgress {
  return {
    bookId: row.book_id,
    lastPage: row.last_page,
    audioPositionSec: Number(row.audio_position_sec),
    updatedAt: row.updated_at,
  }
}

export function useFlipbookProgress(user: User | null, bookId: string | null) {
  const [progress, setProgress] = useState<FlipbookProgress | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(user && bookId))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<{ page: number; sec: number } | null>(null)

  useEffect(() => {
    if (!user || !bookId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('flipbook_progress')
        .select('book_id, last_page, audio_position_sec, updated_at')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle()
      if (!cancelled) {
        setProgress(data ? rowToProgress(data as RawProgressRow) : null)
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, bookId])

  const saveProgress = useCallback(
    (patch: { lastPage: number; audioPositionSec: number }) => {
      if (!user || !bookId) return
      const prev = lastSavedRef.current
      if (
        prev &&
        prev.page === patch.lastPage &&
        Math.abs(prev.sec - patch.audioPositionSec) < 2
      ) {
        return
      }
      lastSavedRef.current = { page: patch.lastPage, sec: patch.audioPositionSec }

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void supabase.from('flipbook_progress').upsert(
          {
            user_id: user.id,
            book_id: bookId,
            last_page: patch.lastPage,
            audio_position_sec: patch.audioPositionSec,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,book_id' },
        )
      }, 800)
    },
    [user, bookId],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return { progress, isLoading, saveProgress }
}
