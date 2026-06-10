'use client'

import { PROBLEMS } from '@/utils/lesson13-data'
import { useLesson13 } from '@/components/math/lesson13/Lesson13Provider'
import HomePage from '@/components/math/lesson13/HomePage'

export default function Lesson13Page() {
  const { solveCount } = useLesson13()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
