'use client'

import { useRef, useEffect } from 'react'
import { useAuth, type WordEntry } from '@rosie/core'
import { useAudioSlots } from '../../hooks/useBaiduReadingAudio'
import { buildPassageKey } from '../../utils/reading-data'
import { lessonAudioUrl } from '../../utils/reading-audio-types'
import { speakWord } from '../../utils/speak'
import { IconButton } from '@rosie/ui/themes'

interface SpeakButtonProps {
  entry?: WordEntry
  word: string
  /** Radix IconButton size, defaults to '2' */
  size?: '1' | '2' | '3'
  /** 仅用于布局（外边距、shrink 等），不覆盖外观 */
  className?: string
}

let currentAudio: HTMLAudioElement | null = null

export default function SpeakButton({ word, entry, size = '2', className }: SpeakButtonProps) {
  const { user } = useAuth()
  const { data: slots, isLoading } = useAudioSlots(entry?.stage ? user : null)
  const key = entry?.stage ? buildPassageKey(entry.stage, entry.unit, entry.lesson) : ''
  const slot = 'word:' + word.trim().toLowerCase()
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(
    () => () => {
      audio.current?.pause()
      if (audio.current === currentAudio) currentAudio = null
      audio.current = null
    },
    [key, word],
  )
  return (
    <IconButton
      type="button"
      variant="ghost"
      color="gray"
      size={size}
      radius="full"
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label={`朗读 ${word}`}
      onClick={(e) => {
        e.stopPropagation()
        currentAudio?.pause()
        currentAudio = null
        if (!slots.includes(key + '#' + slot)) {
          speakWord(word)
          return
        }
        window.speechSynthesis?.cancel()
        const player = new Audio(lessonAudioUrl(key, slot))
        audio.current = currentAudio = player
        void player.play().catch(() => {
          if (audio.current === player && currentAudio === player) speakWord(word)
        })
      }}
      className={className}
    >
      🔊
    </IconButton>
  )
}
