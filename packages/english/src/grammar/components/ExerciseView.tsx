'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GrammarExerciseGroup, GrammarExerciseItem } from '../types'

const BLANK = '______'

type ItemStatus = 'idle' | 'correct' | 'wrong'

/** 归一化用户输入与标准答案：小写、去首尾空白、统一撇号、折叠空格 */
function normalize(s: string): string {
  return s
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** 把答案拆成与空格数量匹配的期望片段 */
function parseExpected(item: GrammarExerciseItem, blankCount: number): string[] {
  const answer = item.answer.trim()
  if (!answer) return []
  if (blankCount >= 2) {
    if (answer.includes(', ')) {
      const parts = answer.split(', ')
      if (parts.length === blankCount) return parts
    }
    if (answer.includes('. ')) {
      const parts = answer.split('. ').map((p) => (p.endsWith('.') ? p : `${p}.`))
      if (parts.length === blankCount) return parts
    }
  }
  return [answer]
}

function isGraded(item: GrammarExerciseItem): boolean {
  return item.answer.trim() !== ''
}

interface ItemCardProps {
  item: GrammarExerciseItem
  values: string[]
  status: ItemStatus
  onChange: (blankIdx: number, value: string) => void
  onCheck: () => void
}

function ItemCard({ item, values, status, onChange, onCheck }: ItemCardProps) {
  const openEnded = !isGraded(item)
  const parts = item.prompt.split(BLANK)
  const blankCount = parts.length - 1

  const inputClass = (idx: number) => {
    const base =
      'mx-1 inline-block min-w-20 rounded-lg border-2 bg-surface-dim px-2 py-0.5 text-center text-[15px] font-semibold text-text-primary outline-none transition-colors'
    if (status === 'idle') return `${base} border-border-light focus:border-app-blue`
    const expected = parseExpected(item, blankCount)
    const v = normalize(values[idx] ?? '')
    const ok =
      v !== '' &&
      (v === normalize(expected[idx] ?? expected[0] ?? '') ||
        expected.some((e) => normalize(e) === v))
    return ok
      ? `${base} border-app-green bg-app-green-light text-app-green-dark`
      : `${base} border-app-red bg-app-red-light text-app-red`
  }

  return (
    <div
      className={`rounded-xl p-3 ring-1 transition-shadow ${
        status === 'correct'
          ? 'bg-app-green-light/40 ring-app-green/40'
          : status === 'wrong'
            ? 'animate-wiggle bg-app-red-light/30 ring-app-red/30'
            : 'bg-surface ring-border-light'
      }`}
    >
      <div className="flex flex-wrap items-center gap-y-1.5 text-[15px] leading-relaxed text-text-primary">
        <span className="mr-1.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-surface-dim text-[11px] font-bold text-text-muted ring-1 ring-border-light">
          {item.number}
        </span>
        {parts.map((part, i) => (
          <span key={i} className="contents">
            {part}
            {i < blankCount &&
              (openEnded ? (
                <input
                  className="mx-1 inline-block w-40 rounded-lg border-2 border-dashed border-border-light bg-surface-dim px-2 py-0.5 text-[15px] font-medium text-text-primary outline-none focus:border-app-purple"
                  value={values[i] ?? ''}
                  onChange={(e) => onChange(i, e.target.value)}
                  placeholder="自由作答"
                />
              ) : (
                <input
                  className={inputClass(i)}
                  value={values[i] ?? ''}
                  onChange={(e) => onChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCheck()
                  }}
                  placeholder="?"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              ))}
          </span>
        ))}
        {!openEnded && status === 'idle' && (
          <button
            onClick={onCheck}
            className="ml-1.5 shrink-0 rounded-full bg-app-blue px-3 py-0.5 text-xs font-bold text-white transition-transform active:scale-95"
          >
            检查
          </button>
        )}
        {status === 'correct' && <span className="ml-1.5 text-sm font-bold text-app-green-dark">✔ 正确</span>}
        {openEnded && (
          <span className="ml-1.5 rounded-full bg-app-purple-light px-2 py-0.5 text-[11px] font-bold text-app-purple-dark">
            开放题
          </span>
        )}
      </div>
      {status === 'wrong' && item.answer && (
        <div className="mt-1.5 pl-7 text-[13px] text-text-secondary">
          参考答案：<span className="font-semibold text-text-primary">{item.answer}</span>
        </div>
      )}
    </div>
  )
}

interface ExerciseGroupProps {
  group: GrammarExerciseGroup
  groupIdx: number
  /** 组内全部可判分题判定完成后上报（重做后结果变化会再次上报） */
  onGroupResult: (groupIdx: number, correct: number, total: number) => void
}

function ExerciseGroup({ group, groupIdx, onGroupResult }: ExerciseGroupProps) {
  const [inputs, setInputs] = useState<Record<string, string[]>>({})
  const [statuses, setStatuses] = useState<Record<number, ItemStatus>>({})

  const itemKey = (n: number) => `g${groupIdx}-${n}`
  const graded = useMemo(() => group.items.filter(isGraded), [group.items])
  const correctCount = graded.filter((it) => statuses[it.number] === 'correct').length
  const allJudged = graded.length > 0 && graded.every((it) => statuses[it.number] === 'correct' || statuses[it.number] === 'wrong')

  // 组级完成上报：全部可判分题判定后触发；结果变化（重做）时再次触发
  const reportedRef = useRef('')
  useEffect(() => {
    if (!allJudged) return
    const sig = `${correctCount}/${graded.length}`
    if (reportedRef.current === sig) return
    reportedRef.current = sig
    onGroupResult(groupIdx, correctCount, graded.length)
  }, [allJudged, correctCount, graded.length, groupIdx, onGroupResult])

  const handleCheck = (item: GrammarExerciseItem) => {
    const blankCount = item.prompt.split(BLANK).length - 1
    const values = inputs[itemKey(item.number)] ?? []
    if (values.every((v) => !v || !v.trim())) return
    const expected = parseExpected(item, blankCount)
    const normValues = values.map((v) => normalize(v ?? ''))
    const ok = normValues.every(
      (v, i) =>
        v === normalize(expected[i] ?? expected[0] ?? '') || expected.some((e) => normalize(e) === v),
    )
    setStatuses((prev) => ({ ...prev, [item.number]: ok ? 'correct' : 'wrong' }))
  }

  const handleReset = () => {
    setInputs({})
    setStatuses({})
    reportedRef.current = ''
  }

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border-light sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-app-purple to-pink-500 px-2.5 py-1 text-sm font-black text-white">
          {group.section}
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-text-primary">{group.instruction}</p>
        {typeof group.bookPage === 'number' && (
          <span className="shrink-0 rounded-full bg-surface-dim px-2 py-0.5 text-[10px] font-bold text-text-muted ring-1 ring-border-light">
            p.{group.bookPage}
          </span>
        )}
        {graded.length > 0 && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              correctCount === graded.length && allJudged
                ? 'bg-app-green-light text-app-green-dark'
                : 'bg-surface-dim text-text-muted ring-1 ring-border-light'
            }`}
          >
            {correctCount}/{graded.length}
          </span>
        )}
      </header>
      <div className="flex flex-col gap-2">
        {group.items.map((item) => (
          <ItemCard
            key={item.number}
            item={item}
            values={inputs[itemKey(item.number)] ?? []}
            status={isGraded(item) ? (statuses[item.number] ?? 'idle') : 'idle'}
            onChange={(blankIdx, value) => {
              setInputs((prev) => {
                const next = [...(prev[itemKey(item.number)] ?? [])]
                next[blankIdx] = value
                return { ...prev, [itemKey(item.number)]: next }
              })
              setStatuses((prev) => (prev[item.number] ? { ...prev, [item.number]: 'idle' } : prev))
            }}
            onCheck={() => handleCheck(item)}
          />
        ))}
      </div>
      {correctCount > 0 && (
        <button
          onClick={handleReset}
          className="mt-3 text-xs font-semibold text-text-muted underline-offset-2 hover:underline"
        >
          重做本组
        </button>
      )}
    </section>
  )
}

export interface ExerciseViewProps {
  groups: GrammarExerciseGroup[]
  onGroupResult: (groupIdx: number, correct: number, total: number) => void
}

export function ExerciseView({ groups, onGroupResult }: ExerciseViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, i) => (
        <ExerciseGroup key={`${group.section}-${i}`} group={group} groupIdx={i} onGroupResult={onGroupResult} />
      ))}
    </div>
  )
}
