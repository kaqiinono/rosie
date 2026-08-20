'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'
import { GrammarStudyGuidePage, isGrammarBookId } from '@rosie/english'

export default function GrammarBookStudyGuideRoute({ params }: { params: Promise<{ book: string }> }) {
  const { book } = use(params)
  if (!isGrammarBookId(book)) redirect('/english/grammar')
  return <GrammarStudyGuidePage book={book} />
}
