'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson30-data'
import { useLesson30 } from '@rosie/math/components/lesson30/Lesson30Provider'
import HomePage from '@rosie/math/components/lesson30/HomePage'

export default function Lesson30Page() {
  const { solveCount } = useLesson30()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
