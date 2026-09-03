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
  const base = `/english/words/reading/story/${series.slug}/${volume.slug}`
  return (
    <main className="font-nunito relative z-[1] mx-auto max-w-4xl px-4 py-6 pb-24">
      <nav className="mb-4 flex items-center justify-between gap-2 text-sm font-bold">
        <Link href={base} className="text-amber-700">
          ← 章节目录
        </Link>
        <span className="text-slate-500">整辑阅读 · {volume.chapters.length} 章</span>
      </nav>
      <StoryReader volume={volume} chapters={volume.chapters} viewMode="volume" />
    </main>
  )
}
