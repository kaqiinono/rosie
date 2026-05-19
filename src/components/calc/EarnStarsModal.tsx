'use client'

/**
 * Vouchers-page wrapper around QuickPracticeModal.
 * Questions are generated one level above the user's current level.
 */

import { useMemo } from 'react'
import QuickPracticeModal from './QuickPracticeModal'
import { buildSession } from '@/utils/calc-helpers'
import { MAX_NUMERIC_LEVEL } from '@/utils/calc-levels'
import { useAuth } from '@/contexts/AuthContext'
import type { CalcMistake, CalcSettings } from '@/utils/type'

interface Props {
  gap: number
  settings: CalcSettings
  mistakes: CalcMistake[]
  soundEnabled: boolean
  onClose: (starsEarned: number) => void
}

export default function EarnStarsModal({ gap, settings, mistakes, soundEnabled, onClose }: Props) {
  const { user } = useAuth()
  // Bump level by 1 for more challenge (capped at MAX_NUMERIC_LEVEL).
  // In free-practice mode the user already picked exactly what they want, so leave it alone.
  const boostedSettings = useMemo<CalcSettings>(() => {
    if (settings.freeMode) return settings
    return {
      ...settings,
      currentLevel: typeof settings.currentLevel === 'number'
        ? Math.min(settings.currentLevel + 1, MAX_NUMERIC_LEVEL)
        : settings.currentLevel,
    }
  }, [settings])

  // Generate enough questions to comfortably fill the gap (with buffer)
  const count = Math.min(Math.max(10, Math.ceil(gap * 1.6)), 20)

  // Build questions once
  const questions = useMemo(
    () => buildSession(
      boostedSettings,
      count,
      mistakes,
      {
        problemStates: new Map(),
        userId: user?.id ?? 'anonymous',
        sessionNo: 0,
        today: new Date().toISOString().slice(0, 10),
      },
      'free',
    ),
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
