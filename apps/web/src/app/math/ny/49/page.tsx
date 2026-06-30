'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson49-data'
import { useLesson49 } from '@rosie/math/components/lesson49/Lesson49Provider'
import HomePage from '@rosie/math/components/lesson49/HomePage'

export default function Lesson49Page() {
  const { solveCount } = useLesson49()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
