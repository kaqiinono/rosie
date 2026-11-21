import Link from 'next/link'
import type { StorySeries, StoryVolume } from '../../utils/story-types'
import StoryReader from './StoryReader'

export default function StoryFullVolumeView({
  series,
  volume,
}: {
  series: StorySeries
  volume: StoryVolume
}) {
  const base = `/stories/${series.slug}/${volume.slug}`
  const guide = volume.kind === 'guide'
  const chapters = volume.chapters.map((chapter) => {
    const illustrations = chapter.illustrations
    if (!illustrations?.some(({ chapterOnly }) => chapterOnly)) return chapter
    return { ...chapter, illustrations: illustrations.filter(({ chapterOnly }) => !chapterOnly) }
  })
  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-4xl px-4 py-6 pb-24">
      <nav className="mb-4 flex items-center justify-between gap-2 text-sm font-bold">
        <Link href={base} className="text-amber-700">
          ← {guide ? '分节目录' : '章节目录'}
        </Link>
        <span className="text-slate-500">
          {guide ? '整册阅读' : '整辑阅读'} · {volume.chapters.length} {guide ? '节' : '章'}
        </span>
      </nav>
      <StoryReader
        seriesSlug={series.slug} volume={{ slug: volume.slug, title: volume.title, kind: volume.kind, originalAudioFiles: volume.originalAudioFiles }}
        chapters={chapters} viewMode="volume"
      />
    </main>
  )
}
