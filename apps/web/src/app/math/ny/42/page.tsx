'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson42-data'
import { useLesson42 } from '@rosie/math/components/lesson42/Lesson42Provider'
import HomePage from '@rosie/math/components/lesson42/HomePage'

export default function Lesson42Page() {
  const { solveCount } = useLesson42()
  return <HomePage problems={PROBLEMS} solveCount={solveCount} />
}
