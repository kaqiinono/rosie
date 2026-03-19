'use client'

import { useWordsContext } from '@/contexts/WordsContext'
import WeeklyPractice from '@/components/english/words/WeeklyPractice'

export default function DailyPage() {
  const { vocab } = useWordsContext()
  return <WeeklyPractice vocab={vocab} />
}
