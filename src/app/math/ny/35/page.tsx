'use client'

import { PROBLEMS } from '@/utils/lesson35-data'
import { useLesson35 } from '@/components/math/lesson35/Lesson35Provider'
import HomePage from '@/components/math/lesson35/HomePage'

export default function Lesson35Home() {
  const { solveCount } = useLesson35()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
