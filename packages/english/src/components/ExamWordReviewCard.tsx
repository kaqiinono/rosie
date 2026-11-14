'use client'

import type { WordEntry, WordMasteryInfo } from '@rosie/core'
import WordPopup, { type WordSourceContext } from './reading/WordPopup'

export type ExamWordReviewCardProps = { word: WordEntry | null; source?: WordSourceContext; mastery?: WordMasteryInfo; onClose: () => void }
export function ExamWordReviewCard({ word, source, mastery, onClose }: ExamWordReviewCardProps) {
  return <WordPopup entry={word} sourceContext={source} mastery={mastery} showMastery={mastery !== undefined} onClose={onClose} />
}
