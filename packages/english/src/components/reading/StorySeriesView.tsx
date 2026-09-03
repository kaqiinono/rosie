import Link from 'next/link'
import type { StorySeries } from '../../utils/story-types'

export default function StorySeriesView({ series }: { series: StorySeries }) {
  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-5xl px-4 py-8 pb-24">
      <Link href="/english/words/reading" className="text-sm font-bold text-amber-700">
        ← 返回 Story
      </Link>
      <header className="mt-4 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-50 p-6 ring-1 ring-amber-200">
        <p className="text-sm font-bold text-amber-700">{series.author}</p>
        <h1 className="font-fredoka mt-1 text-3xl font-black text-slate-900">{series.title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{series.description}</p>
      </header>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {series.volumes.map((volume) => (
          <li key={volume.slug}>
            <Link
              href={`/english/words/reading/story/${series.slug}/${volume.slug}`}
              className="block rounded-2xl bg-white p-5 no-underline ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-amber-300"
            >
              <p className="text-xs font-extrabold tracking-wider text-amber-600 uppercase">
                第 {volume.number} 辑
              </p>
              <h2 className="font-fredoka mt-1 text-xl font-black text-slate-900">
                {volume.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{volume.description}</p>
              <p className="mt-4 text-xs font-bold text-slate-500">{volume.chapters.length} 章</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
