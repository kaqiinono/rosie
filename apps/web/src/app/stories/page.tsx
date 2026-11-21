import { StoryShelf, storySeries } from '@rosie/english'

export default function StoriesPage() {
  return <StoryShelf entries={storySeries.map(({ volumes, ...series }) => ({
    ...series,
    volumeCount: volumes.filter((volume) => volume.kind !== 'guide').length,
  }))} />
}
