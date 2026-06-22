'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@rosie/math/utils/lesson39-data'
import ProblemDetail from '@rosie/math/components/lesson39/ProblemDetail'

export default function HomeworkProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const list = PROBLEMS.homework
  const problem = list[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
