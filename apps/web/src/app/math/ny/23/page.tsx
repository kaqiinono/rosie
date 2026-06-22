'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson23-data'
import { useLesson23 } from '@rosie/math/components/lesson23/Lesson23Provider'
import HomePage from '@rosie/math/components/lesson23/HomePage'

export default function Lesson23Page() {
  const { solveCount } = useLesson23()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
