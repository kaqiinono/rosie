'use client'

/**
 * Vouchers-page wrapper around QuickPracticeModal.
 * Questions are generated one level above the user's current level.
 */

import { useMemo } from 'react'
import QuickPracticeModal from './QuickPracticeModal'
import { buildSession } from '@/utils/calc-helpers'
import type { CalcMistake, CalcSettings } from '@/utils/type'

interface Props {
  gap: number
  settings: CalcSettings
  mistakes: CalcMistake[]
  soundEnabled: boolean
  onClose: (starsEarned: number) => void
}

export default function EarnStarsModal({ gap, settings, mistakes, soundEnabled, onClose }: Props) {
  // Bump level by 1 for more challenge (capped at levelCap)
  const boostedSettings = useMemo<CalcSettings>(() => ({
    ...settings,
    currentLevel: Math.min(
      typeof settings.currentLevel === 'number' ? settings.currentLevel + 1 : settings.currentLevel,
      typeof settings.levelCap === 'number' ? settings.levelCap : settings.currentLevel,
    ),
  }), [settings])

  // Generate enough questions to comfortably fill the gap (with buffer)
  const count = Math.min(Math.max(10, Math.ceil(gap * 1.6)), 20)

  // Build questions once
  const questions = useMemo(
    () => buildSession(boostedSettings, count, mistakes, 0, 'free'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <QuickPracticeModal
      title="攒星星挑战！"
      subtitle={`答对即得⭐，目标再攒 ${gap} 颗`}
      questions={questions}
      soundEnabled={soundEnabled}
      goalStars={gap}
      onClose={onClose}
      doneLabel="太棒啦，收好星星 →"
    />
  )
}
