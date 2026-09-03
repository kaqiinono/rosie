'use client'

import Link from 'next/link'
import { storySeries } from '../../utils/story-data'

export default function StoryShelf() {
  return (
    <main className="font-nunito relative z-[1] mx-auto w-full max-w-[1280px] px-3 pt-6 pb-24 md:px-4">
      <div className="mb-5">
        <p className="text-xs font-extrabold tracking-[0.18em] text-amber-600 uppercase">
          Story Library
        </p>
        <h1 className="font-fredoka mt-1 text-2xl font-black text-slate-900">📚 故事书架</h1>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {storySeries.map((series) => (
          <li key={series.slug}>
            <Link
              href={`/english/words/reading/story/${series.slug}`}
              className="block rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-white p-6 no-underline shadow-sm ring-1 ring-amber-200 transition hover:-translate-y-1 hover:shadow-lg"
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
