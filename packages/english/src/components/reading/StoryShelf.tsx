'use client'

import { useState } from 'react'
import { ArrowIcon, LearningIcon, PageAccountRow, StickerCard } from '@rosie/ui'
import { Badge, Button } from '@rosie/ui/themes'
import Link from 'next/link'
import type { StorySeries } from '../../utils/story-types'

type ShelfSeries = Omit<StorySeries, 'volumes'> & { volumeCount: number }

const seriesIcons: Partial<Record<string, string>> = {
  'magic-tree-house': '🏡',
  'roald-dahl': '🍫',
}

export default function StoryShelf({ entries }: { entries: ShelfSeries[] }) {
  const [language, setLanguage] = useState<'all' | 'zh' | 'en'>('all')
  const seriesList = entries.filter((series) => language === 'all' || series.language === language)
  return (
    <main className="font-nunito relative z-[1] mx-auto w-full max-w-[1280px] px-3 pt-6 pb-24 md:px-4">
      <div className="mb-5">
        <PageAccountRow>
          <h1 className="font-fredoka text-2xl font-black text-slate-900">📚 故事会</h1>
        </PageAccountRow>
        <div role="group" aria-label="故事语言" className="mt-3 flex gap-2">
          {([['all', '全部'], ['zh', '中文'], ['en', 'English']] as const).map(([value, label]) => (
            <Button key={value} variant={language === value ? 'soft' : 'outline'}
              aria-pressed={language === value} onClick={() => setLanguage(value)}>{label}</Button>
          ))}
        </div>
      </div>
      {seriesList.length === 0 && <p>暂无该语言的故事集。</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seriesList.map((series) => (
          <li key={series.slug}>
            <StickerCard asChild interactive tone="accent" size="lg" elevation="sm" className="flex h-full flex-col">
              <Link href={`/stories/${series.slug}`}>
                <div lang={series.language}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center text-3xl leading-none">
                      {seriesIcons[series.slug] ?? <LearningIcon name="focus" size={32} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-fredoka text-lg leading-tight font-black text-text-primary">{series.title}</h2>
                      <p className="mt-1 text-sm font-bold text-amber-700">
                        {series.seasonNumber && `Season ${series.seasonNumber} · `}{series.author}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{series.description}</p>
                </div>
                <div className="mt-auto pt-3">
                  <Badge variant="soft" radius="full" color="amber">
                    {series.volumeCount} {series.seasonNumber ? '本' : '辑'}
                    <span aria-hidden="true"><ArrowIcon size={12} /></span>
                  </Badge>
                </div>
              </Link>
            </StickerCard>
          </li>
        ))}
      </ul>
    </main>
  )
}
