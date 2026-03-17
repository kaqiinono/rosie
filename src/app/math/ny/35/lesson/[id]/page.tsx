'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson35-data'
import ProblemDetail from '@/components/math/lesson35/ProblemDetail'

export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const problem = PROBLEMS.lesson[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
