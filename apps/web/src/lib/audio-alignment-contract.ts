export type AudioMark = { status: 'timed'; startMs: number; endMs: number } | { status: 'skipped' }
export type AudioMarks = Record<string, AudioMark>

export type AlignmentChoice = { key: string; label: string; module: string; moduleLabel: string }
export type AlignmentTrack = { slot: string; label: string }
export type AlignmentTarget = { id: string; text: string; group: string; candidateMs?: number }

export type AlignmentDocument = {
  targets: AlignmentTarget[]
  marks: AudioMarks
  signature: string
  audioUrl: string
  sourceChanged: boolean
  canSkip: boolean
}

export function alignmentWorkbenchUrl(key = '') {
  return '/admin/tools/audio-alignment' + (key ? '?' + new URLSearchParams({ key }) : '')
}
