'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson36-data'
import { useLesson36 } from '@rosie/math/components/lesson36/Lesson36Provider'
import HomePage from '@rosie/math/components/lesson36/HomePage'

export default function Lesson36Home() {
  const { solveCount } = useLesson36()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
