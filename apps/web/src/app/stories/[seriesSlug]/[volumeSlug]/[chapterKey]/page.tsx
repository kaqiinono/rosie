import { notFound } from 'next/navigation'
import {
  findStoryChapter,
  findStorySeries,
  findStoryVolume,
  storySeries,
  StoryChapterView,
} from '@rosie/english'

export default async function StoryChapterPage({
  params,
}: {
  params: Promise<{ seriesSlug: string; volumeSlug: string; chapterKey: string }>
}) {
  const { seriesSlug, volumeSlug, chapterKey } = await params
  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  const volume = findStoryVolume(series, volumeSlug)
  if (!volume) notFound()
  const chapter = findStoryChapter(volume, chapterKey)
  if (!chapter) notFound()
  return <StoryChapterView series={series} volume={volume} chapter={chapter} />
}
