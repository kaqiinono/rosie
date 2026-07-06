'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson53-data'
import { useLesson53 } from '@rosie/math/components/lesson53/Lesson53Provider'
import HomePage from '@rosie/math/components/lesson53/HomePage'

export default function Lesson53Page() {
  const { solveCount } = useLesson53()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
