'use client'

import { PROBLEMS } from '@/utils/lesson40-data'
import { useLesson40 } from '@/components/math/lesson40/Lesson40Provider'
import HomePage from '@/components/math/lesson40/HomePage'

export default function Lesson40Page() {
  const { solveCount } = useLesson40()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
