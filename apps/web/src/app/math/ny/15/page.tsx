'use client'

import { PROBLEMS } from '@/utils/lesson15-data'
import { useLesson15 } from '@/components/math/lesson15/Lesson15Provider'
import HomePage from '@/components/math/lesson15/HomePage'

export default function Lesson15Page() {
  const { solveCount } = useLesson15()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
