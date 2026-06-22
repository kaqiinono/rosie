'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import { useLesson29 } from '@rosie/math/components/lesson29/Lesson29Provider'
import HomePage from '@rosie/math/components/lesson29/HomePage'

export default function Lesson29Page() {
  const { solveCount } = useLesson29()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
