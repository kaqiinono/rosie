'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson50-data'
import { useLesson50 } from '@rosie/math/components/lesson50/Lesson50Provider'
import HomePage from '@rosie/math/components/lesson50/HomePage'

export default function Lesson50Page() {
  const { solveCount } = useLesson50()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
