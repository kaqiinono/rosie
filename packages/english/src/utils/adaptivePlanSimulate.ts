import type { QuizType } from '@rosie/core'
import { activateWord } from './adaptivePlanBoxes'
import { mapWordToPlanInit } from './adaptivePlanInit'
import { bossQuizTypesForWord, quizTypesForWord } from './adaptivePlanQuizTypes'
import { buildDailyTask } from './adaptivePlanScheduler'
import { settleBossFirstPass, settleStep3 } from './adaptivePlanSettle'
import { adaptiveBoxStage } from './adaptivePlanStages'
import type {
  AdaptivePlanMode,
  AdaptivePlanWordProgress,
  AdaptiveWordPlan,
} from './adaptivePlanTypes'

const BOSS_PASS_PCT = 85

export type SimWordPhase = 'study' | 'step1_review' | 'step3_final' | 'boss'

export type SimWordTouch = {
  wordKey: string
  phase: SimWordPhase
  boxBefore: number | null
  boxAfter: number | null
  statusBefore: AdaptivePlanWordProgress['status']
  statusAfter: AdaptivePlanWordProgress['status']
  quizTypes: QuizType[]
  questionCount: number
  stageLabel: string
}

export type SimDaySnapshot = {
  dayIndex: number
  date: string
  mode: AdaptivePlanMode
  newWordKeys: string[]
  reviewWordKeys: string[]
  bossWordKeys: string[]
  touches: SimWordTouch[]
  studyCount: number
  totalQuestions: number
  promotedCount: number
  masteredToday: string[]
  cumulative: {
    notStarted: number
    learning: number
    mastered: number
    totalActivated: number
    everActivated: number
  }
  planModeAfter: AdaptivePlanMode
  bossFailStreak: number
  note: string
}

export type SimBaseline = {
  date: string
  mode: AdaptivePlanMode
  tally: {
    notStarted: number
    learning: number
    mastered: number
    totalActivated: number
    everActivated: number
  }
  bossFailStreak: number
  bossQuestionTier: number
}

export type SimulateAdaptivePlanOptions = {
  plan: AdaptiveWordPlan
  wordKeys: string[]
  /** Live progress rows — when set, simulation continues from current state. */
  initialRows?: AdaptivePlanWordProgress[]
  startDate?: string
  maxDays?: number
  /** Assume every quiz answer is correct (ideal trajectory). */
  allCorrect?: boolean
  /** Record end-of-day stage per word (for trajectory matrix export). */
  captureStageMatrix?: boolean
}

export type AdaptiveStageMatrix = {
  dayIndices: number[]
  dates: string[]
  words: { wordKey: string; label: string }[]
  /** cells[wordIndex][dayIndex] */
  cells: string[][]
}

export type SimulateAdaptivePlanResult = {
  baseline: SimBaseline
  days: SimDaySnapshot[]
  totalDays: number
  completed: boolean
  wordMasteryDay: Map<string, number>
  /** True when simulation started from saved progress rather than fresh init. */
  resumedFromProgress: boolean
  stageMatrix?: AdaptiveStageMatrix
}

const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  A: '认读（四选一）',
  B: '双向选择',
  C: '看义默写',
  D: '听写',
}

export function quizTypeLabel(type: QuizType): string {
  return QUIZ_TYPE_LABELS[type]
}

export function formatQuizTypes(types: QuizType[]): string {
  if (types.length === 0) return '—'
  return types.map(quizTypeLabel).join(' + ')
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + days, 12)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function unique(keys: string[]): string[] {
  return [...new Set(keys)]
}

function wordLabel(wordKey: string): string {
  const parts = wordKey.split('::')
  return parts[parts.length - 1] ?? wordKey
}

function stageLabelForRow(row: AdaptivePlanWordProgress | undefined): string {
  if (!row) return '未知'
  if (row.status === 'MASTERED') return '✨ 已掌握'
  if (row.status === 'NOT_STARTED') return '💤 未开始'
  if (row.status === 'LEARNING_PENDING') {
    return row.targetBox === 3 ? '⏳ 待激活（蝴蝶箱）' : '⏳ 待激活（蛋箱）'
  }
  const stage = adaptiveBoxStage(row.boxIndex)
  return `${stage.shortLabel} · ${stage.hint}`
}

function initRowsFromKeys(
  plan: AdaptiveWordPlan,
  wordKeys: string[],
): AdaptivePlanWordProgress[] {
  return wordKeys.map((key) => {
    const init = mapWordToPlanInit(key, undefined, false)
    return {
      planId: plan.id,
      userId: plan.userId,
      wordKey: key,
      status: init.status,
      boxIndex: null,
      targetBox: init.target_box,
      streakWrong: 0,
      nextReviewDate: null,
      introducedOn: null,
      archivedAt: null,
    }
  })
}

function countPromoted(
  before: Map<string, AdaptivePlanWordProgress>,
  after: Map<string, AdaptivePlanWordProgress>,
  touched: Set<string>,
): number {
  let n = 0
  for (const key of touched) {
    const b = before.get(key)
    const a = after.get(key)
    if (!b || !a) continue
    const beforeBox = b.status === 'MASTERED' ? 6 : (b.boxIndex ?? 0)
    const afterBox = a.status === 'MASTERED' ? 6 : (a.boxIndex ?? 0)
    if (afterBox > beforeBox) n += 1
  }
  return n
}

function tally(rows: AdaptivePlanWordProgress[]) {
  const active = rows.filter((r) => r.archivedAt == null)
  return {
    notStarted: active.filter((r) => r.status === 'NOT_STARTED').length,
    learning: active.filter((r) => r.status === 'LEARNING' || r.status === 'LEARNING_PENDING')
      .length,
    mastered: active.filter((r) => r.status === 'MASTERED').length,
  }
}

function earliestFutureReviewNote(rows: AdaptivePlanWordProgress[], today: string): string {
  const future = rows
    .filter(
      (r) =>
        r.archivedAt == null &&
        r.status === 'LEARNING' &&
        r.nextReviewDate != null &&
        r.nextReviewDate > today,
    )
    .map((r) => r.nextReviewDate!)
    .sort()
  const next = future[0]
  if (next) {
    return `今日无任务：${future.length} 个词在等待复习日，最近为 ${next}`
  }
  return '今日无练习任务'
}

function firstPassPct(results: { correct: boolean }[]): number {
  if (results.length === 0) return 0
  return (results.filter((r) => r.correct).length / results.length) * 100
}

function buildTouches(args: {
  rowsBefore: Map<string, AdaptivePlanWordProgress>
  rowsAfter: Map<string, AdaptivePlanWordProgress>
  reviewKeys: string[]
  activateKeys: string[]
  bossKeys: string[]
  mode: AdaptivePlanMode
  bossTier: number
  today: string
}): SimWordTouch[] {
  const touches: SimWordTouch[] = []

  for (const key of args.activateKeys) {
    const before = args.rowsBefore.get(key)
    const after = args.rowsAfter.get(key) ?? before
    touches.push({
      wordKey: key,
      phase: 'study',
      boxBefore: before?.boxIndex ?? null,
      boxAfter: after?.boxIndex ?? null,
      statusBefore: before?.status ?? 'NOT_STARTED',
      statusAfter: after?.status ?? 'NOT_STARTED',
      quizTypes: [],
      questionCount: 0,
      stageLabel: '认读卡片（无测验）',
    })
  }

  for (const key of args.reviewKeys) {
    const before = args.rowsBefore.get(key)
    if (!before) continue
    const types = quizTypesForWord(before, undefined, { preferLight: true })
    const after = args.rowsAfter.get(key) ?? before
    touches.push({
      wordKey: key,
      phase: 'step1_review',
      boxBefore: before.boxIndex,
      boxAfter: after?.boxIndex ?? null,
      statusBefore: before.status,
      statusAfter: after?.status ?? before.status,
      quizTypes: types,
      questionCount: types.length,
      stageLabel: stageLabelForRow(before),
    })
  }

  const finalKeys = unique([...args.reviewKeys, ...args.activateKeys])
  for (const key of finalKeys) {
    const before = args.rowsBefore.get(key)
    if (!before) continue
    // Step 3 runs after activation for new words — use post-activation box for new words.
    const rowForQuiz =
      args.activateKeys.includes(key) && before.status !== 'LEARNING'
        ? activateWord(before, args.today)
        : before
    const types = quizTypesForWord(rowForQuiz, undefined, { preferLight: false })
    const after = args.rowsAfter.get(key) ?? before
    touches.push({
      wordKey: key,
      phase: 'step3_final',
      boxBefore: rowForQuiz.boxIndex,
      boxAfter: after?.boxIndex ?? null,
      statusBefore: rowForQuiz.status,
      statusAfter: after?.status ?? rowForQuiz.status,
      quizTypes: types,
      questionCount: types.length,
      stageLabel: stageLabelForRow(rowForQuiz),
    })
  }

  for (const key of args.bossKeys) {
    const before = args.rowsBefore.get(key)
    if (!before) continue
    const types = bossQuizTypesForWord(before, undefined, args.bossTier)
    const after = args.rowsAfter.get(key) ?? before
    touches.push({
      wordKey: key,
      phase: 'boss',
      boxBefore: before.boxIndex,
      boxAfter: after?.boxIndex ?? null,
      statusBefore: before.status,
      statusAfter: after?.status ?? before.status,
      quizTypes: types,
      questionCount: types.length,
      stageLabel: stageLabelForRow(before),
    })
  }

  return touches
}

/**
 * Deterministic ideal-path simulation: one full round per calendar day, all answers correct.
 * Uses the same scheduler + settle helpers as the live session.
 */
export function simulateAdaptivePlan(
  options: SimulateAdaptivePlanOptions,
): SimulateAdaptivePlanResult {
  const {
    plan: inputPlan,
    wordKeys,
    initialRows,
    startDate = '2026-07-01',
    maxDays = 400,
    allCorrect = true,
    captureStageMatrix = false,
  } = options

  const resumedFromProgress = initialRows != null && initialRows.length > 0
  const wordLabels = new Map(wordKeys.map((key) => [key, wordLabelFromKey(key)]))
  const stageMatrixAcc = captureStageMatrix
    ? initStageMatrix(wordKeys, wordLabels)
    : null

  const pushMatrixDay = (dayIndex: number, date: string, snapshotRows: AdaptivePlanWordProgress[]) => {
    if (!stageMatrixAcc) return
    stageMatrixAcc.dayIndices.push(dayIndex)
    stageMatrixAcc.dates.push(date)
    const column = snapshotStageMatrix(wordKeys, snapshotRows, wordLabels)
    for (let w = 0; w < wordKeys.length; w += 1) {
      stageMatrixAcc.cells[w]!.push(column[w]![0]!)
    }
  }

  let plan: AdaptiveWordPlan = {
    ...inputPlan,
    stats: { ...inputPlan.stats },
  }
  let rows = resumedFromProgress
    ? initialRows.map((row) => ({ ...row }))
    : initRowsFromKeys(plan, wordKeys)

  const baselineTally = tally(rows)
  const baseline: SimBaseline = {
    date: startDate,
    mode: plan.mode,
    tally: {
      ...baselineTally,
      totalActivated: plan.stats.totalActivatedCount,
      everActivated: plan.stats.everActivatedCount,
    },
    bossFailStreak: plan.stats.bossFailStreak,
    bossQuestionTier: plan.stats.bossQuestionTier,
  }

  const days: SimDaySnapshot[] = []
  const wordMasteryDay = new Map<string, number>()

  // Words already mastered before projection — anchor mastery day at 0.
  for (const row of rows) {
    if (row.status === 'MASTERED') wordMasteryDay.set(row.wordKey, 0)
  }

  for (let dayIndex = 1; dayIndex <= maxDays; dayIndex += 1) {
    const date = addDays(startDate, dayIndex - 1)
    const rowsBefore = new Map(rows.map((r) => [r.wordKey, { ...r }]))
    const task = buildDailyTask(plan, rows, date)

    const idleDay =
      task.reviewKeys.length === 0 &&
      task.activateKeys.length === 0 &&
      task.bossKeys.length === 0

    if (idleDay) {
      const tallyNow = tally(rows)
      if (tallyNow.learning === 0 && tallyNow.notStarted === 0) {
        break
      }
      days.push({
        dayIndex,
        date,
        mode: task.mode,
        newWordKeys: [],
        reviewWordKeys: [],
        bossWordKeys: [],
        touches: [],
        studyCount: 0,
        totalQuestions: 0,
        promotedCount: 0,
        masteredToday: [],
        cumulative: {
          ...tallyNow,
          totalActivated: plan.stats.totalActivatedCount,
          everActivated: plan.stats.everActivatedCount,
        },
        planModeAfter: plan.mode,
        bossFailStreak: plan.stats.bossFailStreak,
        note: earliestFutureReviewNote(rows, date),
      })
      pushMatrixDay(dayIndex, date, rows)
      continue
    }

    let nextRows = rows
    let nextPlan = { ...plan, stats: { ...plan.stats } }
    let note = ''
    const reviewKeys = task.reviewKeys
    const activateKeys = task.activateKeys
    const bossKeys = task.bossKeys

    if (task.mode === 'boss') {
      if (bossKeys.length === 0) {
        note = 'Boss 模式触发但题包为空'
      } else {
        const firstPassResults = bossKeys.map((wordKey) => ({
          wordKey,
          correct: allCorrect,
        }))
        const settle = settleBossFirstPass({
          progressRows: rows,
          firstPassResults,
          sinkResults: [],
          masteryByKey: {},
          consolidateExemptSet: new Set(),
          currentStats: plan.stats,
          today: date,
        })
        const updateByKey = new Map(settle.progressUpdates.map((r) => [r.wordKey, r]))
        nextRows = rows.map((r) => updateByKey.get(r.wordKey) ?? r)
        nextPlan = {
          ...nextPlan,
          stats: { ...nextPlan.stats, ...settle.planStatsPatch },
        }
        const pct = firstPassPct(firstPassResults)
        if (pct >= BOSS_PASS_PCT) {
          nextPlan = {
            ...nextPlan,
            mode: 'normal',
            stats: {
              ...nextPlan.stats,
              bossFailStreak: 0,
              lastBossActivatedCount: nextPlan.stats.totalActivatedCount,
            },
          }
          note = `Boss 首轮正确率 ${Math.round(pct)}%，通过并恢复普通模式`
        } else {
          nextPlan = { ...nextPlan, mode: 'boss' }
          note = `Boss 首轮正确率 ${Math.round(pct)}%，继续 Boss 模式`
        }
      }
    } else {
      const activateSet = new Set(activateKeys)
      const activatedRows = rows
        .filter((row) => activateSet.has(row.wordKey) && row.status !== 'LEARNING')
        .map((row) => activateWord(row, date))

      if (activatedRows.length > 0) {
        const activatedByKey = new Map(activatedRows.map((r) => [r.wordKey, r]))
        nextRows = rows.map((r) => activatedByKey.get(r.wordKey) ?? r)
        nextPlan = {
          ...nextPlan,
          stats: {
            ...nextPlan.stats,
            everActivatedCount:
              nextPlan.stats.everActivatedCount + activatedRows.length,
            totalActivatedCount:
              nextPlan.stats.totalActivatedCount + activatedRows.length,
          },
        }
      }

      const touchedKeys = unique([...reviewKeys, ...activateKeys])
      const results = touchedKeys.map((wordKey) => ({
        wordKey,
        correct: allCorrect,
      }))

      if (results.length > 0) {
        const settle = settleStep3({
          progressRows: nextRows,
          results,
          masteryByKey: {},
          consolidateExemptSet: new Set(),
          today: date,
        })
        const updateByKey = new Map(settle.progressUpdates.map((r) => [r.wordKey, r]))
        nextRows = nextRows.map((r) => updateByKey.get(r.wordKey) ?? r)
      }

      if (task.mode === 'review_only') {
        note = '复习熔断：今日仅复习，不拉新词'
      } else if (activateKeys.length > 0) {
        note = `新学 ${activateKeys.length} 词 + 复习 ${reviewKeys.length} 词`
      } else {
        note = `仅复习 ${reviewKeys.length} 词`
      }
    }

    const rowsAfter = new Map(nextRows.map((r) => [r.wordKey, r]))
    const touched = new Set([
      ...reviewKeys,
      ...activateKeys,
      ...bossKeys,
    ])
    const touches = buildTouches({
      rowsBefore,
      rowsAfter,
      reviewKeys,
      activateKeys,
      bossKeys,
      mode: task.mode,
      bossTier: plan.stats.bossQuestionTier,
      today: date,
    })

    const masteredToday = nextRows
      .filter((r) => {
        const before = rowsBefore.get(r.wordKey)
        return r.status === 'MASTERED' && before?.status !== 'MASTERED'
      })
      .map((r) => r.wordKey)

    for (const key of masteredToday) {
      if (!wordMasteryDay.has(key)) wordMasteryDay.set(key, dayIndex)
    }

    const studyCount = activateKeys.length
    const totalQuestions = touches.reduce((sum, t) => sum + t.questionCount, 0)
    const promotedCount = countPromoted(rowsBefore, rowsAfter, touched)
    const tallyNow = tally(nextRows)

    days.push({
      dayIndex,
      date,
      mode: task.mode,
      newWordKeys: activateKeys,
      reviewWordKeys: reviewKeys,
      bossWordKeys: bossKeys,
      touches,
      studyCount,
      totalQuestions,
      promotedCount,
      masteredToday,
      cumulative: {
        ...tallyNow,
        totalActivated: nextPlan.stats.totalActivatedCount,
        everActivated: nextPlan.stats.everActivatedCount,
      },
      planModeAfter: nextPlan.mode,
      bossFailStreak: nextPlan.stats.bossFailStreak,
      note,
    })

    plan = nextPlan
    rows = nextRows
    pushMatrixDay(dayIndex, date, rows)

    const done =
      tallyNow.learning === 0 &&
      tallyNow.notStarted === 0 &&
      tallyNow.mastered === wordKeys.length
    if (done) break
  }

  return {
    baseline,
    days,
    totalDays: days.length,
    completed:
      tally(rows).mastered === wordKeys.length && tally(rows).notStarted === 0,
    wordMasteryDay,
    resumedFromProgress,
    ...(stageMatrixAcc
      ? {
          stageMatrix: {
            dayIndices: stageMatrixAcc.dayIndices,
            dates: stageMatrixAcc.dates,
            words: stageMatrixAcc.words,
            cells: stageMatrixAcc.cells,
          },
        }
      : {}),
  }
}

export function wordLabelFromKey(wordKey: string): string {
  return wordLabel(wordKey)
}

const STAGE_CELL_EMOJI = ['🥚', '🐛', '🦋', '🌸', '🌳'] as const

/** Compact end-of-day stage label for matrix cells. */
export function stageCellForRow(row: AdaptivePlanWordProgress | undefined): string {
  if (!row || row.status === 'NOT_STARTED') return '—'
  if (row.status === 'MASTERED') return '👑'
  if (row.status === 'LEARNING_PENDING') return '⏳'
  if (row.status === 'LEARNING' && row.boxIndex != null) {
    const emoji = STAGE_CELL_EMOJI[row.boxIndex - 1]
    return emoji ?? `B${row.boxIndex}`
  }
  return '?'
}

function snapshotStageMatrix(
  wordKeys: string[],
  rows: AdaptivePlanWordProgress[],
  labels: Map<string, string>,
): string[][] {
  const byKey = new Map(rows.map((r) => [r.wordKey, r]))
  return wordKeys.map((key) => [stageCellForRow(byKey.get(key))])
}

function initStageMatrix(
  wordKeys: string[],
  labels: Map<string, string>,
): {
  words: AdaptiveStageMatrix['words']
  cells: string[][]
  dayIndices: number[]
  dates: string[]
} {
  return {
    words: wordKeys.map((wordKey) => ({
      wordKey,
      label: labels.get(wordKey) ?? wordLabelFromKey(wordKey),
    })),
    cells: wordKeys.map(() => [] as string[]),
    dayIndices: [],
    dates: [],
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Render stage matrix as CSV (row=word, col=day). */
export function stageMatrixToCsv(matrix: AdaptiveStageMatrix): string {
  const header = [
    '单词',
    ...matrix.dayIndices.map((day, i) => `D${day} ${matrix.dates[i] ?? ''}`.trim()),
  ]
  const lines = [header.map(csvEscape).join(',')]
  for (let w = 0; w < matrix.words.length; w += 1) {
    const word = matrix.words[w]!
    const row = [word.label, ...matrix.cells[w]!.map((cell) => cell)]
    lines.push(row.map(csvEscape).join(','))
  }
  return `${lines.join('\n')}\n`
}
