'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import type { LessonCharGroup } from '../../utils/grade1-down/types'
import {
  annotatePassageParagraph,
  getLessonPassage,
  type CharMarkKind,
} from '../../utils/chinese-lesson-passage-helpers'

type Props = {
  lessonKey: string
  group: LessonCharGroup | undefined
}

const MARK_CLASS: Record<CharMarkKind, string> = {
  plain: '',
  recognize: 'cn-char-recognize',
  write: 'cn-char-write',
  both: 'cn-char-both',
}

export default function LessonPassageView({ lessonKey, group }: Props) {
  const passage = getLessonPassage(lessonKey)
  const recognize = useMemo(() => new Set(group?.recognize ?? []), [group])
  const write = useMemo(() => new Set(group?.write ?? []), [group])

  if (!passage?.paragraphs.length) {
    return (
      <p className="text-xs text-slate-400 italic">课文原文待录入</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[10px] font-bold">
        <span className="flex items-center gap-1 text-slate-500">
          <span className="inline-block h-3 w-3 rounded border border-sky-300 bg-sky-100" />
          会认
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <span className="inline-block h-3 w-3 rounded border border-rose-400 bg-rose-100" />
          会写
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <span className="inline-block h-3 w-3 rounded border border-violet-400 bg-gradient-to-br from-sky-100 to-rose-100" />
          认+写
        </span>
      </div>
      {passage.paragraphs.map((para, i) => {
        const segments = annotatePassageParagraph(para, recognize, write)
        return (
          <p
            key={`${lessonKey}-p-${i}`}
            className="text-base leading-loose tracking-wide text-slate-800"
          >
            {segments.map((seg, j) => (
              <span
                key={`${i}-${j}`}
                className={clsx(MARK_CLASS[seg.kind], seg.kind !== 'plain' && 'rounded px-0.5')}
              >
                {seg.text}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
