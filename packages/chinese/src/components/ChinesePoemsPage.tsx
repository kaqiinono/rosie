'use client'

import { useMemo } from 'react'
import { useChineseContext } from '../context/ChineseContext'
import { getBookPoems } from '../utils/chinese-book-content'
import PoemList from './poems/PoemList'

export default function ChinesePoemsPage() {
  const { bookSlug } = useChineseContext()
  const poems = useMemo(() => getBookPoems(bookSlug), [bookSlug])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">古诗背诵</h1>
        <p className="mt-1 text-sm text-slate-500">课文古诗 · 园地古诗</p>
      </header>
      <div className="mt-6">
        <PoemList poems={poems} />
      </div>
    </div>
  )
}
