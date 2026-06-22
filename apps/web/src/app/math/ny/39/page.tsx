'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson39-data'
import { useLesson39 } from '@rosie/math/components/lesson39/Lesson39Provider'
import HomePage from '@rosie/math/components/lesson39/HomePage'

export default function Lesson39Home() {
  const { solveCount } = useLesson39()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
