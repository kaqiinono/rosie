export const VIDEO_SOURCES = ['lesson', 'homework', 'pretest', 'supplement', 'workbook'] as const
export type VideoSource = typeof VIDEO_SOURCES[number]
export type VideoProblem = { id: string; label: string; title: string; source: VideoSource }
export type VideoBinding = { problemId: string; fileId: string | null; name: string; available: boolean }
export interface MathVideoEditor {
  lessonKey: string
  generation: string
  directories: { id: string; path: string }[]
  directoryId: string | null
  selectedId: string | null
  revision: string | null
  savedAt: string | null
  version: string | null
  syncedAt: string | null
  files: Record<string, string>
  occupied: Record<string, { lessonKey: string; problemId: string }>
  reviewNames: string[]
  bindings: VideoBinding[]
  problems: VideoProblem[]
}
export function bindingValue(binding: VideoBinding): string {
  return binding.fileId ?? 'legacy:' + binding.name
}
