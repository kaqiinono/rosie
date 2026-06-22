'use client'

import { PROBLEMS } from '@/utils/lesson37-data'
import { useLesson37 } from '@/components/math/lesson37/Lesson37Provider'
import HomePage from '@/components/math/lesson37/HomePage'

export default function Lesson37Home() {
  const { solveCount } = useLesson37()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
