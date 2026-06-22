'use client'

import { PROBLEMS } from '@/utils/lesson39-data'
import { useLesson39 } from '@/components/math/lesson39/Lesson39Provider'
import HomePage from '@/components/math/lesson39/HomePage'

export default function Lesson39Home() {
  const { solveCount } = useLesson39()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
