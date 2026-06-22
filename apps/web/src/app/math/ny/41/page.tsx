'use client'

import { PROBLEMS } from '@/utils/lesson41-data'
import { useLesson41 } from '@/components/math/lesson41/Lesson41Provider'
import HomePage from '@/components/math/lesson41/HomePage'

export default function Lesson41Page() {
  const { solveCount } = useLesson41()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
