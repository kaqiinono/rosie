'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, StickerCard, X } from '@rosie/ui'
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

function RulerBounds({ range, size }: { range: Range; size: number }) {
  const gap = (Math.min(0.92, range.high / size) - Math.max(0.08, range.low / size))
  const close = gap < 0.2
  const labels = close
    ? [{ value: (range.low + range.high) / 2, text: `${number.format(range.low)}–${number.format(range.high)}` }]
    : [range.low, range.high].map(value => ({ value, text: number.format(value) }))
  const inset = close ? '3rem' : '8%'

  return (
    <div className="relative mb-2 h-6 text-xs font-bold tabular-nums">
      {labels.map(({ value, text }) => (
        <span key={value} className="absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-orange-100 px-2 py-1 text-orange-950
          motion-safe:transition-[left] motion-safe:duration-300"
          style={{ left: `clamp(${inset}, ${value / size * 100}%, calc(100% - ${inset}))` }}>
          {text}
        </span>
      ))}
    </div>
  )
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
  const pilot = attempt.version === 2
  const liveEstimate = live || pilot ? attempt.liveRange : null
  const range = live ? liveEstimate : attempt.range
  const comparison = live && mainAnswered > attempt.estimatedFrom ? attempt.range : previousRange
  const [estimateHistory, setEstimateHistory] = useState<{
    id: string
    firstRange: NonNullable<AttemptView['liveRange']>
    explainAt: number | null
  } | null>(null)
  const history = estimateHistory?.id === attempt.id ? estimateHistory : null
  if (pilot && live && liveEstimate) {
    if (!history) {
      setEstimateHistory({ id: attempt.id, firstRange: liveEstimate, explainAt: null })
    } else if (history.explainAt === null && (Math.abs(history.firstRange.center - liveEstimate.center) >= 250 ||
        liveEstimate.high - liveEstimate.low >= history.firstRange.high - history.firstRange.low + 250)) {
      setEstimateHistory({ ...history, explainAt: mainAnswered })
    }
  }
  const scanning = pilot && !range && phase !== 'submitted' && mainAnswered < 12
  const shown = Math.min(12, answered ?? mainAnswered)
  const headline = pilot ? liveEstimate ? `你大约认识 ${number.format(liveEstimate.center)} 个英语单词`
    : scanning ? `正在定位 · 已答 ${shown}/12` : '目前还估不准' : range ? `${number.format(range.low)}–${number.format(range.high)} 词`
    : mainAnswered >= MIN_ESTIMATE_ITEMS || phase === 'submitted' ? '总词数暂无法估计' : '正在估算'
  const hint = pilot ? liveEstimate ? `目前估计在 ${number.format(liveEstimate.low)}–${number.format(liveEstimate.high)} 个之间。`
    : scanning ? '第一小段会遇到不同难度的词。' : '还需要四个词段都有足够的有效作答。' : range ? (live ? `实时粗估 · 已同步 ${attempt.answered} 题，样本越少区间越宽`
    : formal ? '估计范围' : attempt.isPilot ? '试测范围' : '初步范围')
    : live ? '收到首个有效作答后显示实时试算。'
      : mainAnswered >= MIN_ESTIMATE_ITEMS ? '部分层级的有效作答还不够。'
        : '完成至少 48 题且各层证据充足后可出交卷估算。'
  const ticks = rulerTicks(totalWords)

  return (
    <StickerCard as="section" size="md" tone="paper" elevation="flat" aria-label="词汇量卡尺" className="grid gap-3">
      <p className="text-text-secondary text-center text-xs font-medium">{pilot ? '常见英语词 · 阅读识别' : `旧版 · ${totalWords} 词题库识别范围`}</p>
      <div aria-hidden="true">
        {range && <RulerBounds range={range} size={totalWords} />}
        <div className="relative h-4 rounded-md bg-[var(--gray-a4)] sm:h-5">
          {scanning && <span className="absolute inset-0 rounded-md bg-violet-200 motion-safe:animate-pulse" />}
          {range && (
            <span className="absolute inset-y-0 min-w-px rounded-md bg-orange-400
              motion-safe:transition-[left,width] motion-safe:duration-300" style={intervalStyle(range, totalWords)}>
              <span className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-orange-800" />
              <span className="absolute inset-y-0 right-0 w-0.5 rounded-full bg-orange-800" />
            </span>
          )}
          {!pilot && liveEstimate && (
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-orange-950 motion-safe:transition-[left]"
              style={{ left: `${liveEstimate.center / totalWords * 100}%` }} />
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
        {!pilot && liveEstimate && (
          <p className="text-text-secondary text-sm tabular-nums">当前粗估约 {number.format(liveEstimate.center)} 词</p>
        )}
        <p className="text-text-secondary text-xs">{hint}</p>
        {live && (answered ?? attempt.answered) > attempt.answered && (
          <p className="text-text-secondary mt-1 text-xs">还有 {(answered ?? attempt.answered) - attempt.answered} 题待同步</p>
        )}
        {pilot && live && history?.explainAt === mainAnswered && (
          <p className="text-text-secondary mt-1 text-sm">多答几题，我们会更了解你的范围。</p>
        )}
        {pilot && attempt.edge && <p className="text-text-secondary mt-2 text-sm">
          {attempt.edge === 'reading' ? '这次英文选项有些难，目前的范围比较宽。'
            : attempt.edge === 'ceiling' ? '你已接近本次测量上限，实际词汇量可能更高。'
            : '有些词还没学到，可以先休息。'}
        </p>}
        {pilot && <details className="text-text-secondary mt-2 text-xs leading-relaxed">
          <summary className="inline cursor-pointer underline focus-visible:outline-2">家长说明</summary>
          <p className="mt-1">按 4,000 个常见代表词头估计阅读识别量。每个词头只计一次，诊断题只用于复盘。试测范围会随新答案调整，精度仍待口头复核。</p>
        </details>}
        {!pilot && live && !range && mainAnswered < MIN_ESTIMATE_ITEMS && (
          <p className="text-text-secondary mt-1 text-xs tabular-nums">已答 {answered ?? attempt.answered} 题</p>
        )}
        {comparison && <p className="text-text-secondary mt-1 text-xs">
          {live ? '上一个完整段' : '上一段'} {number.format(comparison.low)}–{number.format(comparison.high)} 词
        </p>}
      </div>
      {liveEstimate?.focusLevel && mainAnswered >= MIN_ESTIMATE_ITEMS && phase !== 'question' && (
        <p className="text-text-secondary border-border-light border-t pt-2 text-center text-xs">
          当前最不确定的是 {liveEstimate.focusLevel} 层
        </p>
      )}
    </StickerCard>
  )
}

type SeenWordRow = SeenWord | (Pick<SeenWord, 'index' | 'word'> & { status: 'pending' })
const seenStatusColors = {
  correct: 'green', wrong: 'orange', unknown: 'gray', unreadable: 'gray', pending: 'gray',
} as const

export function AssessmentSeenWords({ words }: { words: SeenWordRow[] }) {
  if (!words.length) return null
  return (
    <StickerCard as="section" tone="white" size="none" elevation="sm" className="overflow-hidden">
      <details open className="group">
        <summary className="relative flex min-h-14 cursor-pointer list-none items-center justify-center gap-2 bg-violet-50 px-10 py-3
          font-bold text-violet-950 focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
          测过的单词
          <Badge variant="soft" radius="full" color="violet">
            {words.length}<span className="sr-only"> 个单词</span>
          </Badge>
          <ChevronDown aria-hidden="true" className="absolute right-4 size-4 group-open:rotate-180" />
        </summary>
        <ul role="list" aria-label="测过的单词列表" tabIndex={0} className="max-h-72 divide-y divide-dashed divide-kid-line overflow-y-auto
          border-t-2 border-kid-line px-4 focus-visible:-outline-offset-2 sm:px-5">
          {[...words].reverse().map(row => (
            <li key={row.index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:gap-5 sm:py-4">
              <div className="min-w-0">
                <strong lang="en" className="block wrap-break-word text-lg leading-snug">{row.word}</strong>
                {row.status !== 'pending' && (
                  <>
                    <p lang="en" className="text-text-secondary mt-1 wrap-break-word text-sm leading-relaxed sm:text-base">{row.definitionEn}</p>
                    {row.definitionZh && <p className="text-sm">{row.definitionZh}</p>}
                    {row.chosen && <p className="text-text-secondary text-xs">你选了 <span lang="en">{row.chosen}</span></p>}
                  </>
                )}
              </div>
              <Badge variant="soft" radius="full" color={seenStatusColors[row.status]}>
                {row.status === 'correct' && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
                {row.status === 'wrong' && <X aria-hidden="true" className="size-4" strokeWidth={3} />}
                {row.status === 'pending' ? '待同步' : statusText[row.status]}
              </Badge>
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
        <h3 className="font-bold">{attempt.version === 2 ? '各千词段作答情况' : '各等级作答情况'}</h3>
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
