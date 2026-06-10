'use client'

import { PROBLEMS } from '@/utils/lesson29-data'
import { useLesson29 } from '@/components/math/lesson29/Lesson29Provider'
import HomePage from '@/components/math/lesson29/HomePage'

export default function Lesson29Page() {
  const { solveCount } = useLesson29()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
