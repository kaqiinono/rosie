export type LessonAudioPick = { directory_id: string; file_id: string; path: string }
export type LessonAudioDirectory = Pick<LessonAudioPick, 'directory_id' | 'path'>
export type LessonInventoryFile = { name: string; directory: string; fileId?: string }

export function directoryPrefix(path: string) {
  return path === '/' ? '/' : path + '/'
}

export type LessonAudioEditor = {
  revision: string | null
  mainDirectory: LessonAudioDirectory | null
  slots: { slot: string; label: string; unbindOnly?: boolean }[]
  picks: Record<string, LessonAudioPick>
}
