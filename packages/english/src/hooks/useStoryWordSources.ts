'use client'

import { useEffect, useRef, useState } from 'react'
import { STORAGE_KEYS, type WordEntry } from '@rosie/core'
import { fetchStageVocab } from './useWordData'

export function useStoryWordSources(userId: string | undefined) {
  const key = userId ? `${STORAGE_KEYS.STORY_WORD_SOURCES}:${userId}` : null
  const [selected, setSelected] = useState<string[]>([])
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const [words, setWords] = useState<WordEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const request = useRef(0)

  if (key !== hydratedKey) {
    setHydratedKey(key)
    let saved: string[] = []
    if (key) {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
        if (Array.isArray(parsed)) saved = parsed.filter((stage) => typeof stage === 'string')
      } catch { /* Storage may be unavailable. */ }
    }
    setSelected(saved)
  }

  useEffect(() => () => { request.current += 1 }, [key])

  function toggle(stage: string) {
    const next = selected.includes(stage) ? selected.filter((item) => item !== stage) : [...selected, stage]
    request.current += 1
    setSelected(next)
    setWords((previous) => previous.filter((word) => word.stage && next.includes(word.stage)))
    setStatus('idle')
    try {
      if (key) localStorage.setItem(key, JSON.stringify(next))
    } catch { /* Retain the current selection in memory. */ }
  }

  async function load(available: string[]) {
    const stages = selected.filter((stage) => available.includes(stage))
    if (!userId || !stages.length) return
    const id = ++request.current
    setStatus('loading')
    try {
      const groups = await Promise.all(stages.map((stage) => fetchStageVocab(userId, stage)))
      if (id === request.current) {
        setWords(groups.flat())
        setStatus('loaded')
      }
    } catch {
      if (id === request.current) setStatus('error')
    }
  }

  return { selected, toggle, words, load, status }
}
