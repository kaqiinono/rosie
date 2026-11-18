import type { ExamMediaEditor, ExamMediaSaveRequest, MediaSlot } from '@rosie/exams'
import { directoryPrefix, type LessonInventoryFile } from '@/lib/english-audio-types'

export function examListeningParts<T extends Pick<MediaSlot, 'id' | 'purpose'>>(
  parts: ExamMediaEditor['parts'], slots: readonly T[],
) {
  const audio = new Map(slots.filter(slot => slot.purpose === 'exam_listening' || slot.purpose === 'training_audio')
    .map(slot => [slot.id, slot] as const))
  return parts.filter(part => part.sectionId === 'listening')
    .map(part => ({ ...part, slots: part.slotIds.flatMap(id => {
      const slot = audio.get(id)
      return slot ? [slot] : []
    }) }))
    .filter(part => part.slots.length > 0)
    .sort((left, right) => left.partNumber - right.partNumber)
}

export function isExamAudioFile(name: string) {
  return /\.(mp3|m4a|aac|wav|ogg)$/i.test(name)
}

type AudioPick = ExamMediaSaveRequest['picks'][number]
type Slot = ExamMediaEditor['slots'][number]

function trackNumber(name: string) {
  const track = /^(?:track\s*|音轨\s*)?(\d+)$/.exec(name)
  return track ? Number(track[1]) : null
}

function normalize(name: string) {
  return name.normalize('NFKC').toLowerCase().replace(/[\s._-]+/g, ' ').trim()
}

function testPrefix(name: string) {
  return /^(?:test\s*(\d+)(?=\s|$)|第\s*(\d+)\s*套)/.exec(name)
}

export function matchExamListeningAudio(
  parts: readonly { partNumber: number; slots: readonly Slot[] }[],
  testNumber: number,
  files: readonly LessonInventoryFile[],
  picks: Readonly<Record<string, AudioPick>>,
  removed: readonly string[],
): Record<string, AudioPick> {
  const slots = new Map(parts.flatMap(part => part.slots.map(slot => [slot.id, slot] as const)))
  const tracks = new Map([...slots.values()].map(slot => [slot.id, trackNumber(normalize(slot.sourceTrackLabel ?? ''))]))
  const occupied = new Set([...slots.values()].map(slot => slot.binding?.fileId).concat(Object.values(picks).map(pick => pick.fileId)))
  const candidates = new Map<string, Map<string, AudioPick>>()
  for (const file of files) {
    if (!file.fileId || occupied.has(file.fileId) || !isExamAudioFile(file.name)) continue
    const name = normalize(file.name.replace(/\.[^.]+$/, ''))
    const fileTest = testPrefix(name)
    const namedTests = [fileTest, ...file.directory.split('/').map(folder => testPrefix(normalize(folder)))]
    if (namedTests.some(test => test && Number(test[1] ?? test[2]) !== testNumber)) continue
    const stem = name.slice(fileTest?.[0].length ?? 0).trim()
    const track = trackNumber(stem)
    const partName = /^(?:(?:listening|听力)\s*)?part\s*(\d+)(?:\s+(?:audio|音频))?$/.exec(stem)
      ?? /^听力\s*第?\s*(\d+)\s*部分(?:\s*音频)?$/.exec(stem)
    const targetPart = partName && parts.find(part => part.partNumber === Number(partName[1]))
    // A Part name alone cannot identify one of several tracks in the Part.
    const matches = track !== null
      ? [...slots.values()].filter(slot => tracks.get(slot.id) === track)
      : targetPart?.slots.length === 1 ? targetPart.slots : []
    if (matches.length !== 1) continue
    const slot = matches[0]
    if (slot.binding || picks[slot.id] || removed.includes(slot.id)) continue
    const group = candidates.get(slot.id) ?? new Map<string, AudioPick>()
    group.set(file.fileId, { slotId: slot.id, fileId: file.fileId, path: directoryPrefix(file.directory) + file.name, reviewed: false, durationMs: null })
    candidates.set(slot.id, group)
  }

  const targetsPerFile = new Map<string, number>()
  for (const group of candidates.values()) {
    for (const fileId of group.keys()) targetsPerFile.set(fileId, (targetsPerFile.get(fileId) ?? 0) + 1)
  }
  const matched: [string, AudioPick][] = []
  for (const [slotId, group] of candidates) {
    if (group.size !== 1) continue
    const [pick] = group.values()
    if (targetsPerFile.get(pick.fileId) === 1) matched.push([slotId, pick])
  }
  return Object.fromEntries(matched)
}
