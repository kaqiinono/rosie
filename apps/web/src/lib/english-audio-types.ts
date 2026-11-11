export type LessonAudioPick = { directory_id: string; file_id: string; path: string }
export type LessonAudioDirectory = Pick<LessonAudioPick, 'directory_id' | 'path'>

export function directoryPrefix(path: string) {
  return path === '/' ? '/' : path + '/'
}

export type LessonAudioEditor = {
  revision: string | null
  mainDirectory: LessonAudioDirectory | null
  slots: { slot: string; label: string }[]
  picks: Record<string, LessonAudioPick>
}
