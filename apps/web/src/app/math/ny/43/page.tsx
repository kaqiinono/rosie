'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson43-data'
import { useLesson43 } from '@rosie/math/components/lesson43/Lesson43Provider'
import HomePage from '@rosie/math/components/lesson43/HomePage'

export default function Lesson43Page() {
  const { solveCount } = useLesson43()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
