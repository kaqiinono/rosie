'use client'

import { PROBLEMS } from '@/utils/lesson23-data'
import { useLesson23 } from '@/components/math/lesson23/Lesson23Provider'
import HomePage from '@/components/math/lesson23/HomePage'

export default function Lesson23Page() {
  const { solveCount } = useLesson23()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
