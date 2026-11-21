import { hasSeparateStoryChapterNumber, type StoryChapter, type StoryVolume } from './story-types'

export interface StoryNarrationTrack {
  slot: string
  file: string
  label: string
  filename?: string
  chapter?: Pick<StoryChapter, 'title' | 'number'>
}

export function storyNarrationTracks(volume: Pick<StoryVolume, 'slug' | 'originalAudioFiles'>, chapters: StoryChapter[]): StoryNarrationTrack[] {
  const book = { slot: 'narration', file: 'full', label: '整本朗读' }
  const chapterTracks = chapters.map(chapter => ({
    slot: `chapter:${chapter.key}`,
    file: chapter.key,
    label: hasSeparateStoryChapterNumber(chapter) ? `第 ${chapter.number} 章 · ${chapter.title}` : chapter.title,
    chapter: { number: chapter.number, title: chapter.title },
  }))
  if (!volume.originalAudioFiles) return [book, ...chapterTracks]

  const byFilename = new Map<string, StoryNarrationTrack>(chapterTracks.map(track => {
    const stem = /^ch\d+$/.test(track.file) ? `chapter-${track.file.slice(2)}` : track.file
    return [`${stem}.mp3`, track] as const
  }))
  return volume.originalAudioFiles.flatMap((filename): StoryNarrationTrack[] => {
    if (filename === `${volume.slug}.mp3`) return [{ ...book, filename }]
    const chapter = byFilename.get(filename)
    if (chapter) return [{ ...chapter, filename }]
    const file = filename.replace(/\.mp3$/, '')
    const part = /^part-(\d+)$/.exec(file)
    if (part) return [{ slot: `track:${file}`, file, filename, label: `音轨 ${Number(part[1])}` }]
    if (file === 'title' || file === 'credits') {
      return [{ slot: `track:${file}`, file, filename, label: file === 'title' ? '片头' : '片尾' }]
    }
    return []
  })
}
