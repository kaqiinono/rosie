'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson51-data'
import { useLesson51 } from '@rosie/math/components/lesson51/Lesson51Provider'
import HomePage from '@rosie/math/components/lesson51/HomePage'

export default function Lesson51Page() {
  const { solveCount } = useLesson51()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
