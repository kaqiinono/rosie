import Link from 'next/link'
import { PageAccountRow } from '@rosie/ui'
import type { StorySeries } from '../../utils/story-types'

export default function StorySeriesView({ series, collection }: {
  series: StorySeries
  collection?: Pick<StorySeries, 'slug' | 'title'>
}) {
  const books = series.volumes.filter((volume) => volume.kind !== 'guide')
  const guides = series.volumes.filter((volume) => volume.kind === 'guide')
  const CardTitle = guides.length ? 'h3' : 'h2'
  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-5xl px-4 py-8 pb-24">
      <PageAccountRow>
        <Link href={collection ? `/stories/${collection.slug}` : '/stories'} className="text-sm font-bold text-amber-700">
          {collection ? `← 返回 ${collection.title}` : '← 返回故事屋'}
        </Link>
      </PageAccountRow>
      <header className="mt-4 rounded-3xl bg-orange-50 p-6 ring-1 ring-amber-200">
        <p className="text-sm font-bold text-amber-700">
          {series.seasonNumber && `Season ${series.seasonNumber} · `}{series.author}
        </p>
        <h1 className="font-fredoka mt-1 text-3xl font-black text-slate-900">{series.title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{series.description}</p>
      </header>
      {[{ label: '分辑', items: books }, { label: '特别版指南', items: guides }].map(({ label, items }) => items.length > 0 && (
        <section key={label} className="mt-6">
          {guides.length > 0 && <h2 className="mb-3 text-sm font-extrabold text-text-secondary">{label}</h2>}
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((volume) => (
              <li key={volume.slug}>
                <Link
                  href={`/stories/${series.slug}/${volume.slug}`}
                  className="ring-kid-line hover:shadow-sticker block rounded-2xl bg-white p-5 no-underline ring-1 transition hover:-translate-y-0.5 hover:ring-amber-300"
                >
                  {volume.kind !== 'guide' && <p className="text-xs font-extrabold tracking-wider text-amber-600">
                    第 {volume.number} {series.seasonNumber ? '册' : '辑'}
                  </p>}
                  <CardTitle className="font-fredoka mt-1 text-xl font-black text-slate-900">
                    {volume.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-slate-600">{volume.description}</p>
                  <p className="mt-4 text-xs font-bold text-slate-500">
                    {volume.chapters.length} {volume.kind === 'guide' ? '节' : '章'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
