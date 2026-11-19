'use client'

import type { User } from '@supabase/supabase-js'
import { baiduReadingAudioUrl, lessonAudioUrl } from '../utils/reading-audio-types'
import { useBaiduReadingAudio } from './useBaiduReadingAudio'
import { useReadingPassageMedia } from './useReadingPassageMedia'

export function useReadingPassageAudio(user: User | null, passageKey: string) {
  const { hasAudio, isLoading } = useBaiduReadingAudio(user)
  const { getUrlForPassage } = useReadingPassageMedia(user)
  if (isLoading) return null
  if (hasAudio(passageKey + '#narration')) return lessonAudioUrl(passageKey, 'narration')
  if (hasAudio(passageKey)) return baiduReadingAudioUrl(passageKey)
  return getUrlForPassage(passageKey)
}
