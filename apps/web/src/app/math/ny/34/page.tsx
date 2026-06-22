'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson34-data'
import { useLesson34 } from '@rosie/math/components/lesson34/Lesson34Provider'
import HomePage from '@rosie/math/components/lesson34/HomePage'

export default function Lesson34Home() {
  const { solveCount } = useLesson34()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
