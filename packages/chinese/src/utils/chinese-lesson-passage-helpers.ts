import type { LessonPassageEntry } from '../utils/grade1-down/types'
import { LESSON_PASSAGES } from '../utils/grade1-down/lesson-passages'

const passageMap = new Map(LESSON_PASSAGES.map((p) => [p.lessonKey, p]))

export function getLessonPassage(lessonKey: string): LessonPassageEntry | undefined {
  return passageMap.get(lessonKey)
}

export type CharMarkKind = 'plain' | 'recognize' | 'write' | 'both'

export interface PassageSegment {
  text: string
  kind: CharMarkKind
}

/** 将课文段落按本课认读/会写字标注 */
export function annotatePassageParagraph(
  paragraph: string,
  recognize: Set<string>,
  write: Set<string>,
): PassageSegment[] {
  const segments: PassageSegment[] = []
  let buf = ''
  let kind: CharMarkKind = 'plain'

  const flush = () => {
    if (buf) {
      segments.push({ text: buf, kind })
      buf = ''
      kind = 'plain'
    }
  }

  for (const ch of paragraph) {
    const isRecognize = recognize.has(ch)
    const isWrite = write.has(ch)
    let next: CharMarkKind = 'plain'
    if (isRecognize && isWrite) next = 'both'
    else if (isWrite) next = 'write'
    else if (isRecognize) next = 'recognize'

    if (next !== kind && buf) flush()
    kind = next
    buf += ch
  }
  flush()
  return segments
}

export type { LessonPassageEntry }
