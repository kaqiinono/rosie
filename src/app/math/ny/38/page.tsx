'use client'

import { PROBLEMS } from '@/utils/lesson38-data'
import { useLesson38 } from '@/components/math/lesson38/Lesson38Provider'
import HomePage from '@/components/math/lesson38/HomePage'

export default function Lesson38Home() {
  const { solveCount } = useLesson38()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
