'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import { useLesson37 } from '@rosie/math/components/lesson37/Lesson37Provider'
import HomePage from '@rosie/math/components/lesson37/HomePage'

export default function Lesson37Home() {
  const { solveCount } = useLesson37()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
