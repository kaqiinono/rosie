'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PROBLEMS } from '@/utils/lesson42-data'
import ProblemDetail from '@/components/math/lesson42/ProblemDetail'

export default function WorkbookProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const index = parseInt(id) - 1
  const list = PROBLEMS.workbook
  const problem = list[index]
  if (!problem) notFound()
  return <ProblemDetail problem={problem} />
}
