'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS, LESSON_TIP } from '@/utils/lesson36-data'
import ProblemDetail from '@/components/math/lesson36/ProblemDetail'

export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const problem = PROBLEMS.lesson[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} tip={LESSON_TIP} />
}
