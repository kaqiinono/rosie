'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson44-data'
import { useLesson44 } from '@rosie/math/components/lesson44/Lesson44Provider'
import HomePage from '@rosie/math/components/lesson44/HomePage'

export default function Lesson44Page() {
  const { solveCount } = useLesson44()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
