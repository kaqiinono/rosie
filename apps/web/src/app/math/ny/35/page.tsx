'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson35-data'
import { useLesson35 } from '@rosie/math/components/lesson35/Lesson35Provider'
import HomePage from '@rosie/math/components/lesson35/HomePage'

export default function Lesson35Home() {
  const { solveCount } = useLesson35()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
