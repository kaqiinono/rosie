'use client'

import { useState } from 'react'
import { Button } from '@rosie/ui/themes'
import Link from 'next/link'
import { storySeries } from '../../utils/story-data'

export default function StoryShelf() {
  const [language, setLanguage] = useState<'all' | 'zh' | 'en'>('all')
  const seriesList = storySeries.filter((series) => language === 'all' || series.language === language)
  return (
    <main className="font-nunito relative z-[1] mx-auto w-full max-w-[1280px] px-3 pt-6 pb-24 md:px-4">
      <div className="mb-5">
        <h1 className="font-fredoka text-2xl font-black text-slate-900">📚 故事会</h1>
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
            <Link
              href={`/stories/${series.slug}`}
              className="shadow-sticker-sm hover:shadow-sticker block rounded-3xl bg-orange-50 p-6 no-underline ring-1 ring-amber-200 transition hover:-translate-y-1"
            >
              <div className="mb-5 text-5xl">🏡</div>
              <h2 className="font-fredoka text-2xl font-black text-slate-900">{series.title}</h2>
              <p className="mt-1 text-sm font-bold text-amber-700">{series.author}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{series.description}</p>
              <p className="mt-4 text-xs font-bold text-slate-500">{series.volumes.length} 辑</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
