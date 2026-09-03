import Link from 'next/link'
import type { StoryChapter, StorySeries, StoryVolume } from '../../utils/story-types'
import StoryReader from './StoryReader'

export default function StoryChapterView({
  series,
  volume,
  chapter,
}: {
  series: StorySeries
  volume: StoryVolume
  chapter: StoryChapter
}) {
  const index = volume.chapters.findIndex((entry) => entry.key === chapter.key)
  const previous = volume.chapters[index - 1]
  const next = volume.chapters[index + 1]
  const base = `/english/words/reading/story/${series.slug}/${volume.slug}`
  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-4xl px-4 py-6 pb-24">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-bold">
        <Link href={base} className="text-amber-700">
          ← 章节目录
        </Link>
        <Link
          href={`${base}/full`}
          className="ml-auto rounded-full bg-white px-3 py-1.5 text-amber-700 ring-1 ring-amber-200"
        >
          阅读整辑
        </Link>
      </nav>
      <StoryReader volume={volume} chapters={[chapter]} viewMode="chapter" />
      <nav className="mt-8 flex justify-between gap-3">
        {previous ? (
          <Link
            href={`${base}/${previous.key}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200"
          >
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`${base}/${next.key}`}
            className="rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white"
          >
            {next.title} →
          </Link>
        ) : (
          <Link
            href={base}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            完成本辑
          </Link>
        )}
      </nav>
    </main>
  )
}
