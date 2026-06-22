'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson37-data'
import ProblemDetail from '@/components/math/lesson37/ProblemDetail'

export default function PretestProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const problem = PROBLEMS.pretest[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
