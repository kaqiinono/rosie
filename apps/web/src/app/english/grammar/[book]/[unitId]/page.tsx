'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'
import { GrammarUnitPage, GRAMMAR_BOOKS, isGrammarBookId } from '@rosie/english'

export default function GrammarBookUnitRoute({
  params,
}: {
  params: Promise<{ book: string; unitId: string }>
}) {
  const { book, unitId } = use(params)
  if (!isGrammarBookId(book)) redirect('/english/grammar')
  const unitNumber = Number.parseInt(unitId, 10)
  // essential 允许书尾延展位 116-169；其他书暂以正文单元上限为准（书尾结构接入时再扩展）
  const upper = book === 'essential' ? 169 : GRAMMAR_BOOKS[book].maxUnits
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > upper) {
    redirect(`/english/grammar/${book}`)
  }
  return <GrammarUnitPage unitNumber={unitNumber} book={book} />
}
