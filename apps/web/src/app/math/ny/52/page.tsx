'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson52-data'
import { useLesson52 } from '@rosie/math/components/lesson52/Lesson52Provider'
import HomePage from '@rosie/math/components/lesson52/HomePage'

export default function Lesson52Page() {
  const { solveCount } = useLesson52()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
