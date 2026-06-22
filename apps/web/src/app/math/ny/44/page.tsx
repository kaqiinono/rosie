'use client'

import { PROBLEMS } from '@/utils/lesson44-data'
import { useLesson44 } from '@/components/math/lesson44/Lesson44Provider'
import HomePage from '@/components/math/lesson44/HomePage'

export default function Lesson44Page() {
  const { solveCount } = useLesson44()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
