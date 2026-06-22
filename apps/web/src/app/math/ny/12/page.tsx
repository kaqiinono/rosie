'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson12-data'
import { useLesson12 } from '@rosie/math/components/lesson12/Lesson12Provider'
import HomePage from '@rosie/math/components/lesson12/HomePage'

export default function Lesson12Page() {
  const { solveCount } = useLesson12()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
