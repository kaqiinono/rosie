import { lessonAudioMime } from '@rosie/english/utils/reading-audio-types'
import { directoryPrefix, type LessonAudioDirectory, type LessonAudioEditor, type LessonAudioPick, type LessonInventoryFile } from './english-audio-types'

function normalize(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const courseCode = /(?:\b(\d+[a-z])[\s_-]*)?u(?:nit)?\s*0*(\d+)[\s_-]*l(?:esson)?\s*0*(\d+)(?!\d)/i
const listening = /听记|听写|分句|逐句|\b(?:listening|dictation|clips?|sentences?)\b/
const vocabulary = /单词|词汇|\b(?:words|vocab|vocabulary)\b/
const recitation = /背诵|\b(?:recite|recitation)\b/
const narration = /课文|原文|朗读|\b(?:narration|passage|reading|text)\b/

export function matchEnglishAudio(
  lessonKey: string, slots: LessonAudioEditor['slots'], picks: LessonAudioEditor['picks'],
  main: LessonAudioDirectory, files: LessonInventoryFile[],
) {
  const active = slots.filter(row => !row.unbindOnly)
  const clips = active.filter(row => row.slot.startsWith('clip:'))
  const words = active.filter(row => row.slot.startsWith('word:')).map(row => ({ slot: row.slot, word: normalize(row.label) }))
  const lesson = courseCode.exec(lessonKey)
  const occupied = new Set(Object.values(picks).map(pick => pick.file_id))
  const candidates = new Map<string, LessonAudioPick[]>()
  const unmatched: LessonAudioPick[] = []
  let remaining = 0

  for (const file of files) {
    if (!file.fileId || occupied.has(file.fileId) || !lessonAudioMime(file.name)) continue
    const stem = file.name.normalize('NFKC').replace(/\.[^.]+$/, '')
    const folders = file.directory.slice(directoryPrefix(main.path).length).split('/')
    const codes = [...folders, stem].map(part => courseCode.exec(part)).filter(code => code !== null)
    if (codes.some(code => !lesson || code[2] !== lesson[2] || code[3] !== lesson[3] ||
      (code[1] && code[1].toLowerCase() !== lesson[1]?.toLowerCase()))) continue

    remaining++
    const pick = { directory_id: main.directory_id, file_id: file.fileId, path: directoryPrefix(file.directory) + file.name }
    const name = normalize(stem.replace(courseCode, ' '))
    const folder = normalize(folders.join(' '))
    const word = name.replace(/^\d+\s+/, '')
    const exact = words.filter(row => row.word === word).map(row => row.slot)
    const inListening = listening.test(folder)
    const inWords = vocabulary.test(folder)
    const number = /^(?:(?:听记|听写|分句|逐句|clip|sentence|listening|dictation)\s*)?(?:第\s*)?(\d+)(?:\s*[句段])?$/.exec(name)
      ?? (inListening ? /^(\d+)\s+/.exec(name) : null)
    let targets: string[] = []
    if (exact.length && !inListening) {
      targets = exact
    } else if (number && !inWords) {
      const clip = clips[Number(number[1]) - 1]
      if (clip) targets.push(clip.slot)
    } else if (recitation.test(name) || recitation.test(folder)) {
      targets.push('recitation')
    } else if (vocabulary.test(name)) {
      targets.push('words')
    } else if (!inListening && !inWords && !listening.test(name)) {
      if (narration.test(name) || (!name && courseCode.test(stem))) targets.push('narration')
      else if (!number && !/^\d+\s/.test(name)) unmatched.push(pick)
    }
    for (const slot of targets) {
      const group = candidates.get(slot) ?? []
      group.push(pick)
      candidates.set(slot, group)
    }
  }

  const matches: Record<string, LessonAudioPick> = {}
  const targetsPerFile = new Map<string, number>()
  for (const group of candidates.values()) {
    for (const file of group) targetsPerFile.set(file.file_id, (targetsPerFile.get(file.file_id) ?? 0) + 1)
  }
  for (const [slot, group] of candidates) {
    if (!picks[slot] && group.length === 1 && targetsPerFile.get(group[0].file_id) === 1) matches[slot] = group[0]
  }
  if (!picks.narration && !candidates.has('narration') && unmatched.length === 1 &&
    remaining - Object.keys(matches).length === 1) matches.narration = unmatched[0]
  return matches
}
