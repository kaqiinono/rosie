'use client'

import { PROBLEMS } from '@/utils/lesson42-data'
import { useLesson42 } from '@/components/math/lesson42/Lesson42Provider'
import HomePage from '@/components/math/lesson42/HomePage'

export default function Lesson42Page() {
  const { solveCount } = useLesson42()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
