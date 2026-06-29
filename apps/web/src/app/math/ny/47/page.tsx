'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson47-data'
import { useLesson47 } from '@rosie/math/components/lesson47/Lesson47Provider'
import HomePage from '@rosie/math/components/lesson47/HomePage'

export default function Lesson47Page() {
  const { solveCount } = useLesson47()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
