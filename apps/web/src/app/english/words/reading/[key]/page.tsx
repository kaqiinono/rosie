'use client'

import { use } from 'react'
import ReadingPassageDetail from '@/components/reading/ReadingPassageDetail'

export default function ReadingPassagePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  return <ReadingPassageDetail key={key} passageKey={key} />
}
