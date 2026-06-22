'use client'

import { PROBLEMS } from '@/utils/lesson30-data'
import { useLesson30 } from '@/components/math/lesson30/Lesson30Provider'
import HomePage from '@/components/math/lesson30/HomePage'

export default function Lesson30Page() {
  const { solveCount } = useLesson30()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
