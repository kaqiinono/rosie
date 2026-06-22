'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson40-data'
import { useLesson40 } from '@rosie/math/components/lesson40/Lesson40Provider'
import HomePage from '@rosie/math/components/lesson40/HomePage'

export default function Lesson40Page() {
  const { solveCount } = useLesson40()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
