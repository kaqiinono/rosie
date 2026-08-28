'use client'

import { useMemo } from 'react'
import { useChineseContext } from '../context/ChineseContext'
import { getBookPoems } from '../utils/chinese-book-content'
import PoemList from './poems/PoemList'
import { ChinesePageHeader, ChinesePageShell } from './ChinesePageLayout'

export default function ChinesePoemsPage() {
  const { bookSlug } = useChineseContext()
  const poems = useMemo(() => getBookPoems(bookSlug), [bookSlug])

  return (
    <ChinesePageShell width="wide">
      <ChinesePageHeader title="古诗背诵" description="课文古诗 · 园地古诗" />
      <div>
        <PoemList poems={poems} />
      </div>
    </ChinesePageShell>
  )
}
