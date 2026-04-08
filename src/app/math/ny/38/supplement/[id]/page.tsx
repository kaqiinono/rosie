'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson38-data'
import ProblemDetail from '@/components/math/lesson38/ProblemDetail'

export default function SupplementProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const list = PROBLEMS.supplement ?? []
  const problem = list[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
