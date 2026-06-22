'use client'

import { PROBLEMS } from '@/utils/lesson18-data'
import { useLesson18 } from '@/components/math/lesson18/Lesson18Provider'
import HomePage from '@/components/math/lesson18/HomePage'

export default function Lesson18Page() {
  const { solveCount } = useLesson18()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
