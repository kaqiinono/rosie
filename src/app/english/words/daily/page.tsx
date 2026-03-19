'use client'

import { useWordsContext } from '@/contexts/WordsContext'
import DailyPractice from '@/components/english/words/DailyPractice'

export default function DailyPage() {
  const { vocab } = useWordsContext()
  return <DailyPractice vocab={vocab} />
}
