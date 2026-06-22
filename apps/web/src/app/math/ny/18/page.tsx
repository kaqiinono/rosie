'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson18-data'
import { useLesson18 } from '@rosie/math/components/lesson18/Lesson18Provider'
import HomePage from '@rosie/math/components/lesson18/HomePage'

export default function Lesson18Page() {
  const { solveCount } = useLesson18()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
