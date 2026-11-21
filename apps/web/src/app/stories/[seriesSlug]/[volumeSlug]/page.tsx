import { notFound } from 'next/navigation'
import { findStorySeries, findStoryVolume, storySeries, StoryVolumeView } from '@rosie/english'

export default async function StoryVolumePage({
  params,
}: {
  params: Promise<{ seriesSlug: string; volumeSlug: string }>
}) {
  const { seriesSlug, volumeSlug } = await params
  const series = findStorySeries(storySeries, seriesSlug)
  if (!series) notFound()
  const volume = findStoryVolume(series, volumeSlug)
  if (!volume) notFound()
  const { chapters, ...summary } = volume
  return <StoryVolumeView
    series={{ slug: series.slug, title: series.title, seasonNumber: series.seasonNumber }}
    volume={{ ...summary, chapters: chapters.map(({ key, number, title }) => ({ key, number, title })) }}
  />
}
