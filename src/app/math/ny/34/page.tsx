'use client'

import { PROBLEMS } from '@/utils/lesson34-data'
import { useLesson34 } from '@/components/math/lesson34/Lesson34Provider'
import HomePage from '@/components/math/lesson34/HomePage'

export default function Lesson34Home() {
  const { solveCount } = useLesson34()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
