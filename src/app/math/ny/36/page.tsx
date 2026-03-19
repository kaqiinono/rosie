'use client'

import { PROBLEMS } from '@/utils/lesson36-data'
import { useLesson36 } from '@/components/math/lesson36/Lesson36Provider'
import HomePage from '@/components/math/lesson36/HomePage'

export default function Lesson36Home() {
  const { solveCount } = useLesson36()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
