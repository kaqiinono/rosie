import type { WordMasteryInfo } from '@rosie/core'
import { ensureStageInit, isGraduated } from '@rosie/core'
import type { CharMasteryMap } from '../hooks/useCharMastery'
import type { LessonCharGroup } from './grade1-down/types'
import type { CharTrack } from './chinese-helpers'
import g1DownStats from './grade1-down/stats.json'

export const G1_DOWN_RECOGNIZE_TOTAL = g1DownStats.targetRecognizeTable
export const G1_DOWN_WRITE_TOTAL = g1DownStats.targetWriteTable

export type ChineseMasteryStats = {
  recognizePracticed: number
  recognizeTotal: number
  writePracticed: number
  writeTotal: number
  recognizeGraduated: number
  writeGraduated: number
}

function parseMasteryKey(mapKey: string): { track: CharTrack } | null {
  const idx = mapKey.lastIndexOf('::')
  if (idx < 0) return null
  const track = mapKey.slice(idx + 2)
  if (track !== 'recognize' && track !== 'write') return null
  return { track }
}

function isPracticed(m: WordMasteryInfo): boolean {
  return (m.correct ?? 0) + (m.incorrect ?? 0) > 0 || !!m.lastSeen
}

export function countLessonCharTotals(lessonGroups: LessonCharGroup[]): {
  recognizeTotal: number
  writeTotal: number
} {
  const recognize = new Set<string>()
  const write = new Set<string>()
  for (const g of lessonGroups) {
    for (const ch of g.recognize) recognize.add(ch)
    for (const ch of g.write) write.add(ch)
  }
  return { recognizeTotal: recognize.size, writeTotal: write.size }
}

export function computeChineseMasteryStats(
  masteryMap: CharMasteryMap,
  lessonGroups: LessonCharGroup[] = [],
): ChineseMasteryStats {
  const today = new Date().toISOString().slice(0, 10)
  let recognizePracticed = 0
  let writePracticed = 0
  let recognizeGraduated = 0
  let writeGraduated = 0

  for (const [mapKey, raw] of Object.entries(masteryMap)) {
    const parsed = parseMasteryKey(mapKey)
    if (!parsed) continue
    const m = ensureStageInit(raw, today)
    if (!isPracticed(m)) continue
    if (parsed.track === 'recognize') {
      recognizePracticed++
      if (isGraduated(m)) recognizeGraduated++
    } else {
      writePracticed++
      if (isGraduated(m)) writeGraduated++
    }
  }

  const totals =
    lessonGroups.length > 0
      ? countLessonCharTotals(lessonGroups)
      : { recognizeTotal: G1_DOWN_RECOGNIZE_TOTAL, writeTotal: G1_DOWN_WRITE_TOTAL }

  return {
    recognizePracticed,
    recognizeTotal: totals.recognizeTotal,
    writePracticed,
    writeTotal: totals.writeTotal,
    recognizeGraduated,
    writeGraduated,
  }
}
