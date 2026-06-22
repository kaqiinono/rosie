'use client'

import { useWordsContext } from '@rosie/english'
import { WeeklyPractice } from '@rosie/english'

export default function DailyPage() {
  const { vocab } = useWordsContext()
  return <WeeklyPractice vocab={vocab} />
}
