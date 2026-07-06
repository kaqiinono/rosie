'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson55-data'
import { useLesson55 } from '@rosie/math/components/lesson55/Lesson55Provider'
import HomePage from '@rosie/math/components/lesson55/HomePage'

export default function Lesson55Page() {
  const { solveCount } = useLesson55()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
