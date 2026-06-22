'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson41-data'
import { useLesson41 } from '@rosie/math/components/lesson41/Lesson41Provider'
import HomePage from '@rosie/math/components/lesson41/HomePage'

export default function Lesson41Page() {
  const { solveCount } = useLesson41()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
