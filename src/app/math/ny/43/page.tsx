'use client'

import { PROBLEMS } from '@/utils/lesson43-data'
import { useLesson43 } from '@/components/math/lesson43/Lesson43Provider'
import HomePage from '@/components/math/lesson43/HomePage'

export default function Lesson43Page() {
  const { solveCount } = useLesson43()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
