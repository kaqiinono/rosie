'use client'

import { PROBLEMS } from '@/utils/lesson45-data'
import { useLesson45 } from '@/components/math/lesson45/Lesson45Provider'
import HomePage from '@/components/math/lesson45/HomePage'

export default function Lesson45Page() {
  const { solveCount } = useLesson45()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
