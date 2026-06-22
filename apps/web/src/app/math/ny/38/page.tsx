'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson38-data'
import { useLesson38 } from '@rosie/math/components/lesson38/Lesson38Provider'
import HomePage from '@rosie/math/components/lesson38/HomePage'

export default function Lesson38Home() {
  const { solveCount } = useLesson38()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
