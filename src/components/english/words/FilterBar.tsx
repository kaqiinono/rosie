'use client'

import type {WordEntry} from '@/utils/type'
import {getAllUnits, getAllLessons} from '@/utils/english-helpers'

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
          <span
            className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            Unit
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {units.map(u => (
              <button
                key={u}
                onClick={() => onToggleUnit(u)}
                className={`px-3 py-1.5 rounded-full border-[1.5px] font-nunito text-[.78rem] font-bold cursor-pointer transition-all select-none whitespace-nowrap ${
                  selUnits.has(u)
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] border-[var(--wm-accent)] text-white shadow-[0_2px_8px_rgba(233,69,96,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span
            className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            Lesson
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {lessons.map(l => (
              <button
                key={l}
                onClick={() => onToggleLesson(l)}
                className={`px-3 py-1.5 rounded-full border-[1.5px] font-nunito text-[.78rem] font-bold cursor-pointer transition-all select-none whitespace-nowrap ${
                  selLessons.has(l)
                    ? 'bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] border-[var(--wm-accent4)] text-white shadow-[0_2px_8px_rgba(96,165,250,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span
            className="text-[.7rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider pt-1.5 min-w-[62px]">
            单词
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1 max-h-24 overflow-y-auto">
            {baseWords.map(v => (
              <button
                key={v.word}
                onClick={() => onToggleWord(v.word)}
                className={`px-3 py-1.5 rounded-full border-[1.5px] font-nunito text-[.78rem] font-bold cursor-pointer transition-all select-none whitespace-nowrap ${
                  selWords.has(v.word)
                    ? 'bg-gradient-to-br from-[var(--wm-accent2)] to-[#e67e22] border-[var(--wm-accent2)] text-white shadow-[0_2px_8px_rgba(245,166,35,.3)]'
                    : 'bg-[var(--wm-surface2)] border-[var(--wm-border)] text-[var(--wm-text-dim)] hover:border-[var(--wm-accent4)] hover:text-[var(--wm-text)]'
                }`}
              >
                {v.word}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span
            className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] text-[var(--wm-text-dim)] px-2.5 py-1.5 rounded-full text-[.78rem] font-bold">
            {filteredCount} 词
          </span>
          <button
            onClick={onClearWords}
            className="px-3 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-lg text-[var(--wm-text-dim)] font-nunito text-[.75rem] font-bold cursor-pointer transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]"
          >
            清除单词筛选
          </button>
          <div className="w-px h-[22px] bg-[var(--wm-border)]"/>
          <button
            onClick={onFlipAll}
            className="px-4 py-1.5 bg-gradient-to-br from-[var(--wm-accent4)] to-[#3b82f6] border-0 rounded-lg text-white font-nunito font-bold text-[.82rem] cursor-pointer transition-all flex items-center gap-1.5 hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(96,165,250,.4)]"
          >
            🔄 {allFlipped ? '全部翻回' : '全部翻面'}
          </button>
        </div>
      </div>
    </div>
  )
}
