'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson46-data'
import { useLesson46 } from '@rosie/math/components/lesson46/Lesson46Provider'
import HomePage from '@rosie/math/components/lesson46/HomePage'

export default function Lesson46Page() {
  const { solveCount } = useLesson46()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
