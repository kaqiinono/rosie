'use client'

import { PROBLEMS } from '@/utils/lesson12-data'
import { useLesson12 } from '@/components/math/lesson12/Lesson12Provider'
import HomePage from '@/components/math/lesson12/HomePage'

export default function Lesson12Page() {
  const { solveCount } = useLesson12()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
