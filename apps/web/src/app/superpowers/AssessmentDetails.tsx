'use client'

import { useEffect, useRef, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Button } from '@rosie/ui/themes'
import { MIN_ESTIMATE_ITEMS, type AttemptView, type Range, type ReviewStatus, type SeenWord } from '@rosie/english/assessment/model'

const number = new Intl.NumberFormat('zh-CN')
const statusText: Record<ReviewStatus, string> = {
  correct: '答对', wrong: '答错', unknown: '不认识', unreadable: '看不懂选项',
}
const filters = [
  ['all', '全部'],
  ['wrong', statusText.wrong],
  ['unknown', statusText.unknown],
  ['unreadable', statusText.unreadable],
] as const

function intervalStyle(interval: Range, size: number) {
  return { left: `${interval.low / size * 100}%`, width: `${(interval.high - interval.low) / size * 100}%` }
}

function rulerTicks(size: number) {
  const spacing = Math.max(1, size / 4)
  const unit = 10 ** Math.floor(Math.log10(spacing))
  const step = ([1, 2, 5, 10].find(factor => factor * unit >= spacing) ?? 10) * unit
  const minorStep = Math.max(1, step / 5)
  const ticks = Array.from({ length: Math.ceil(size / minorStep) }, (_, index) => {
    const value = index * minorStep
    const major = value % step === 0
    return { value, major, label: value === 0 || (major && size - value >= size * 0.12) }
  })
  return [...ticks, { value: size, major: true, label: true }]
}

export function AssessmentRuler({ attempt, live = false, answered }: {
  attempt: AttemptView
  live?: boolean
  answered?: number
}) {
  const { previousRange, totalWords, mainAnswered, formal, phase } = attempt
  const range = live ? attempt.liveRange : attempt.range
  const comparison = live ? (range ? attempt.range : null) : previousRange
  const headline = range ? `${number.format(range.low)}–${number.format(range.high)} 词`
    : mainAnswered >= MIN_ESTIMATE_ITEMS || phase === 'submitted' ? '总词数暂无法估计' : '正在估算'
  const hint = range ? (live ? '实时试算 · 随已保存作答更新'
    : formal ? '估计范围' : attempt.isPilot ? '试测范围' : '初步范围')
    : mainAnswered >= MIN_ESTIMATE_ITEMS || phase === 'submitted' ? '部分层级的有效作答还不够。'
      : '累计 48 题且各层证据充足后显示范围。'
  const ticks = rulerTicks(totalWords)

  return (
    <StickerCard as="section" size="md" tone="paper" elevation="flat" aria-label="词汇量卡尺" className="grid gap-3">
      <p className="text-text-secondary text-center text-xs font-medium">Rosie KET／PET／FCE · 本版词库识别范围</p>
      <div aria-hidden="true">
        <div className="relative h-4 rounded-md bg-[var(--gray-a4)] sm:h-5">
          {range && (
            <span className="absolute inset-y-0 min-w-px rounded-md bg-orange-500
              motion-safe:transition-[left,width] motion-safe:duration-300" style={intervalStyle(range, totalWords)} />
          )}
          {comparison && (
            <span className="absolute -top-1 min-w-px border-t-2 border-dashed border-[var(--gray-9)]"
              style={intervalStyle(comparison, totalWords)} />
          )}
        </div>
        <div className="relative mt-1.5 h-8 text-xs tabular-nums">
          {ticks.map(({ value, major, label }) => (
            <span key={value} className="absolute top-0" style={{ left: `${value / totalWords * 100}%` }}>
              <span className={`absolute top-0 w-px -translate-x-1/2 ${major
                ? 'h-2.5 bg-[var(--gray-10)]' : 'h-1.5 bg-[var(--gray-8)]'}`} />
              {label && <span className={`text-text-secondary absolute top-3 whitespace-nowrap
                ${value === 0 ? '' : value === totalWords ? '-translate-x-full' : '-translate-x-1/2'}`}>
                {number.format(value)}
              </span>}
            </span>
          ))}
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true" className="text-center">
        <p className="text-lg font-bold tabular-nums sm:text-xl">{headline}</p>
        <p className="text-text-secondary text-xs">{hint}</p>
        {live && !range && mainAnswered < MIN_ESTIMATE_ITEMS && (
          <p className="text-text-secondary mt-1 text-xs tabular-nums">已答 {answered ?? attempt.answered} 题</p>
        )}
        {comparison && <p className="text-text-secondary mt-1 text-xs">
          {live ? '上一个完整段' : '上一段'} {number.format(comparison.low)}–{number.format(comparison.high)} 词
        </p>}
      </div>
    </StickerCard>
  )
}

const seenStatuses: Record<SeenWord['decision'], string> = {
  answer: '已作答', unknown: '不认识', unreadable: '看不懂选项',
}

export function AssessmentSeenWords({ words }: { words: SeenWord[] }) {
  if (!words.length) return null
  return (
    <StickerCard as="section" tone="white" size="md" elevation="flat">
      <details>
        <summary className="cursor-pointer font-semibold">测过的单词 · {words.length}</summary>
        <ul className="divide-border-light mt-2 max-h-64 overflow-y-auto divide-y">
          {[...words].reverse().map(({ index, word, decision }) => (
            <li key={index} className="flex items-center justify-between gap-3 py-2">
              <strong lang="en" className="min-w-0 break-words">{word}</strong>
              <span className="text-text-secondary shrink-0 text-xs">{seenStatuses[decision]}</span>
            </li>
          ))}
        </ul>
      </details>
    </StickerCard>
  )
}

export function AssessmentResults({ attempt, pending, onStart }: {
  attempt: AttemptView
  pending: boolean
  onStart: () => void
}) {
  const [filter, setFilter] = useState<typeof filters[number][0]>('all')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const review = attempt.review ?? []
  const visible = filter === 'all' ? review : review.filter(item => item.status === filter)

  return (
    <div className="grid gap-4">
      <div>
        <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 text-2xl font-bold">完成词汇测评！</h2>
        <p className="text-text-secondary mt-1 text-sm">
          已答 {attempt.answered} 题 · {attempt.isPilot ? '试测结果' : attempt.formal ? '正式结果' : '阶段结果'}
        </p>
      </div>
      <AssessmentRuler attempt={attempt} />
      <StickerCard as="section" elevation="flat" className="grid gap-3">
        <h3 className="font-bold">各等级作答情况</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {attempt.bands.map(band => (
            <div key={band.level} className="grid gap-1">
              <dt className="text-sm font-semibold">{band.level}</dt>
              <dd className="text-text-secondary text-sm">{band.proportion === null
                ? '证据不足' : `估计认识 ${Math.round(band.proportion * 100)}%`}</dd>
              <dd className="text-text-secondary text-xs">{band.valid} / {band.answered} 道有效</dd>
            </div>
          ))}
        </dl>
        <p className="text-text-secondary text-xs">
          {attempt.estimatedFrom > 0 && `按已完成的 ${attempt.estimatedFrom} 道分段主测题计算 · `}
          题库版本 {attempt.bankVersion.slice(0, 15)}
        </p>
      </StickerCard>
      <StickerCard as="section" aria-labelledby="vocab-review-heading" size="lg" className="grid gap-4">
        <div>
          <h3 id="vocab-review-heading" className="text-xl font-bold">单词回顾</h3>
          <p className="text-text-secondary mt-1 text-sm">Word Screen</p>
        </div>
        <div role="group" aria-label="按作答状态筛选" className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => (
            <Button key={value} type="button" size="3" aria-pressed={filter === value}
              variant={filter === value ? 'solid' : 'soft'} onClick={() => setFilter(value)}>{label}</Button>
          ))}
        </div>
        <p role="status" className="text-text-secondary text-sm">共 {visible.length} 个词</p>
        <ol className="border-border-light divide-border-light divide-y border-t">
          {visible.map(item => (
            <li key={item.senseId} className="grid gap-2 py-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <strong lang="en" className="text-xl">{item.word}</strong>
                <span lang="en" className="text-text-secondary text-sm">{item.partOfSpeech}</span>
                <Badge variant="soft" color={item.status === 'correct' ? 'green' : item.status === 'wrong' ? 'red' : 'gray'}>
                  {statusText[item.status]}
                </Badge>
              </div>
              {item.context && <p lang="en">{item.context}</p>}
              {item.status === 'wrong' && item.optionIndex !== null && (
                <p className="text-text-secondary text-sm">你选了 <span lang="en">{item.options[item.optionIndex]}</span></p>
              )}
              <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="text-text-secondary text-sm">正确英文释义</dt>
                <dd lang="en" className="font-medium">{item.definitionEn}</dd>
                <dt className="text-text-secondary text-sm">中文意思</dt>
                <dd>{item.definitionZh}</dd>
              </dl>
              {item.status === 'wrong' && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-text-secondary">查看原题选项</summary>
                  <ol lang="en" className="mt-2 list-[upper-alpha] space-y-1 pl-6">
                    {item.options.map(option => <li key={option}>{option}</li>)}
                  </ol>
                </details>
              )}
            </li>
          ))}
        </ol>
        {!visible.length && <p className="text-text-secondary text-sm">这个分类暂无单词。</p>}
      </StickerCard>
      <Button type="button" size="4" variant="soft" loading={pending} onClick={onStart}
        className="justify-self-start">开始新测评</Button>
    </div>
  )
}
