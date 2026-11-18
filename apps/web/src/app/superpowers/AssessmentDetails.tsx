'use client'

import { useEffect, useRef, useState } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Button } from '@rosie/ui/themes'
import { MIN_ESTIMATE_ITEMS, type AttemptView, type Range, type ReviewStatus } from '@rosie/english/assessment/model'

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

export function AssessmentRuler({ attempt }: { attempt: AttemptView }) {
  const { range, previousRange, totalWords, mainAnswered, formal, phase } = attempt
  const headline = range ? `${number.format(range.low)}–${number.format(range.high)} 词`
    : mainAnswered >= MIN_ESTIMATE_ITEMS || phase === 'submitted' ? '总词数暂无法估计' : '正在估算'
  const hint = range ? (formal ? '估计范围' : attempt.isPilot ? '试测范围' : '初步范围')
    : mainAnswered >= MIN_ESTIMATE_ITEMS || phase === 'submitted' ? '部分层级的有效作答还不够。'
      : '完成四小段后，会根据各层作答更新范围。'
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(totalWords * index / 4))

  return (
    <StickerCard as="section" size="md" tone="paper" elevation="flat" aria-label="词汇量卡尺" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-text-secondary text-sm font-medium">Rosie KET／PET／FCE</p>
          <p className="text-text-secondary text-xs">本版收录词头的阅读识别量</p>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <p className="text-lg font-bold tabular-nums sm:text-xl">{headline}</p>
          <p className="text-text-secondary text-xs">{hint}</p>
        </div>
      </div>
      <div aria-hidden="true">
        <div className="relative h-5 rounded-full border border-violet-200 bg-violet-100">
          {range && <span className="absolute inset-y-0 min-w-px rounded-full bg-violet-600
            motion-safe:transition-[left,width] motion-safe:duration-300" style={intervalStyle(range, totalWords)} />}
          {previousRange && <span className="absolute bottom-[-4px] min-w-px border-b-2 border-slate-500"
            style={intervalStyle(previousRange, totalWords)} />}
        </div>
        <div className="relative mt-2 h-6 text-xs tabular-nums">
          {ticks.map((tick, index) => (
            <span key={index} className={`text-text-secondary absolute grid justify-items-center gap-0.5
              ${index === 0 ? '' : index === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${index * 25}%` }}>
              <span className={`h-1.5 w-px bg-slate-400 ${index === 0 ? 'justify-self-start'
                : index === ticks.length - 1 ? 'justify-self-end' : ''}`} />
              <span>{number.format(tick)}</span>
            </span>
          ))}
        </div>
      </div>
      {previousRange && <p className="text-text-secondary text-xs">
        上一次 {number.format(previousRange.low)}–{number.format(previousRange.high)} 词
      </p>}
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
