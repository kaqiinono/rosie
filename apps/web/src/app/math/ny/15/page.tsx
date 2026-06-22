'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson15-data'
import { useLesson15 } from '@rosie/math/components/lesson15/Lesson15Provider'
import HomePage from '@rosie/math/components/lesson15/HomePage'

export default function Lesson15Page() {
  const { solveCount } = useLesson15()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
