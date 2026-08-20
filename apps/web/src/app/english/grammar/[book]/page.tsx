'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'
import { GrammarHomePage, isGrammarBookId } from '@rosie/english'

export default function GrammarBookRoute({ params }: { params: Promise<{ book: string }> }) {
  const { book } = use(params)
  // 旧 URL /english/grammar/5 → /english/grammar/essential/5
  if (/^\d+$/.test(book)) redirect(`/english/grammar/essential/${book}`)
  if (!isGrammarBookId(book)) redirect('/english/grammar')
  return <GrammarHomePage book={book} />
}
