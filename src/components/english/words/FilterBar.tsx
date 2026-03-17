'use client'

import type { WordEntry } from '@/utils/type'
import { getAllUnits, getAllLessons } from '@/utils/english-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RotateCcw, X } from 'lucide-react'

interface FilterBarProps {
  vocab: WordEntry[]
  selUnits: Set<string>
  selLessons: Set<string>
  selWords: Set<string>
  filteredCount: number
  allFlipped: boolean
  onToggleUnit: (unit: string) => void
  onToggleLesson: (lesson: string) => void
  onToggleWord: (word: string) => void
  onClearWords: () => void
  onFlipAll: () => void
}

export default function FilterBar({
  vocab, selUnits, selLessons, selWords, filteredCount,
  allFlipped, onToggleUnit, onToggleLesson, onToggleWord, onClearWords, onFlipAll,
}: FilterBarProps) {
  const units = getAllUnits(vocab)
  const lessons = getAllLessons(vocab, selUnits)
  const baseWords = vocab.filter(v => {
    if (selUnits.size && !selUnits.has(v.unit)) return false
    if (selLessons.size && !selLessons.has(v.lesson)) return false
    return true
  })

  return (
    <div className="bg-[var(--wm-surface)] border-b border-[var(--wm-border)] px-4 py-3">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            Unit
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {units.map(u => (
              <Badge
                key={u}
                onClick={() => onToggleUnit(u)}
                className={cn(
                  'cursor-pointer select-none whitespace-nowrap border-[1.5px] px-3 py-1.5 text-[.78rem] font-bold transition-all',
                  selUnits.has(u)
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] border-[var(--wm-accent)] text-white shadow-[0_2px_8px_rgba(233,69,96,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                )}
              >
                {u}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            Lesson
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {lessons.map(l => (
              <Badge
                key={l}
                onClick={() => onToggleLesson(l)}
                className={cn(
                  'cursor-pointer select-none whitespace-nowrap border-[1.5px] px-3 py-1.5 text-[.78rem] font-bold transition-all',
                  selLessons.has(l)
                    ? 'bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] border-[var(--wm-accent4)] text-white shadow-[0_2px_8px_rgba(96,165,250,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                )}
              >
                {l}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            单词
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1 max-h-24 overflow-y-auto">
            {baseWords.map(v => (
              <Badge
                key={v.word}
                onClick={() => onToggleWord(v.word)}
                className={cn(
                  'cursor-pointer select-none whitespace-nowrap border-[1.5px] px-3 py-1.5 text-[.78rem] font-bold transition-all',
                  selWords.has(v.word)
                    ? 'bg-gradient-to-br from-[var(--wm-accent2)] to-[#e67e22] border-[var(--wm-accent2)] text-white shadow-[0_2px_8px_rgba(245,166,35,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                )}
              >
                {v.word}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <Badge variant="secondary" className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] text-[var(--wm-text-dim)] px-2.5 py-1.5 text-[.78rem] font-bold">
            {filteredCount} 词
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearWords}
            className="border-[var(--wm-border)] text-[var(--wm-text-dim)] font-nunito text-[.75rem] font-bold hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)] bg-transparent"
          >
            <X className="h-3 w-3" />
            清除单词筛选
          </Button>
          <div className="w-px h-[22px] bg-[var(--wm-border)]" />
          <Button
            onClick={onFlipAll}
            variant="gradient"
            size="sm"
            className="bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] font-nunito font-bold text-[.82rem] hover:shadow-[0_4px_14px_rgba(96,165,250,.4)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {allFlipped ? '全部翻回' : '全部翻面'}
          </Button>
        </div>
      </div>
    </div>
  )
}
