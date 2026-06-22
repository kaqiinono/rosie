'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson13-data'
import { useLesson13 } from '@rosie/math/components/lesson13/Lesson13Provider'
import HomePage from '@rosie/math/components/lesson13/HomePage'

export default function Lesson13Page() {
  const { solveCount } = useLesson13()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
