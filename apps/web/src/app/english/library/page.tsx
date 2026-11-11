'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import { wordEntriesStore } from '@rosie/english'
import { PageBreadcrumb } from '@rosie/ui'
import { Button, TextField } from '@rosie/ui/themes'

const PAGE_SIZE = 50

export default function LibraryPage() {
  const { user } = useAuth()
  const { data: words, isLoading, error } = wordEntriesStore.useSessionData(user)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term
      ? words.filter((w) =>
          [w.word, w.chineseDef, w.explanation].some((value) =>
            value?.toLowerCase().includes(term),
          ),
        )
      : words
  }, [query, words])

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <PageBreadcrumb variant="inline" />
      <h1 className="text-2xl font-black">词库</h1>
      <TextField.Root
        type="search"
        aria-label="检索词库"
        placeholder="输入英文单词或中英文释义"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setLimit(PAGE_SIZE)
        }}
        size="3"
        className="w-full"
      />
      {error ? (
        <p role="alert">词库读取失败，请刷新重试。</p>
      ) : isLoading || !user ? (
        <p>正在读取词库…</p>
      ) : (
        <>
          <p role="status" className="text-text-secondary text-sm">
            {results.length ? `共 ${results.length} 条` : '没有找到词条'}
          </p>
          <ul className="divide-border-light border-border-light bg-surface divide-y rounded-xl border px-4">
            {results.slice(0, limit).map((w) => (
              <li
                key={JSON.stringify([w.stage, w.unit, w.lesson, w.word])}
                className="space-y-1 py-3"
              >
                <strong>{w.word}</strong>{' '}
                <span className="text-text-secondary text-sm">{w.ipa}</span>
                {w.chineseDef && <p>{w.chineseDef}</p>}
                {w.explanation && <p>{w.explanation}</p>}
                <p className="text-text-muted text-xs">
                  {[w.stage, w.unit, w.lesson].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
          {results.length > limit && (
            <Button
              onClick={() => setLimit(limit + PAGE_SIZE)}
              variant="outline"
              color="gray"
              size="2"
            >
              显示更多
            </Button>
          )}
        </>
      )}
    </main>
  )
}
