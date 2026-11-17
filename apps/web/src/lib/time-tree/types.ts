import type { PracticeProgress, StepPractice } from './practice'
import type { Apple, CoreSubject, SubjectKey } from '@/components/tree-demo/garden/model'

/** Cumulative snapshot at the end of the previous or current daily session. */
export interface FlowerProgress {
  availableFrom?: string
  collected: number
  elapsedMs: number
  complete: boolean
  answered?: string[]
}

export interface WorkStep {
  /** This completion earned the day's all-academic-work rainbow. */
  dailyRainbow?: true
  crown?: true
  flowers?: FlowerProgress
  practice?: StepPractice | null
  practiceEntryName?: string
  id: string
  occurrence: string
  name: string
  notes: string
  planNote?: string
  subject: SubjectKey
  priority: string
  minutes: number
  scheduled: string
  planned: string | null
  deadline: string
  start: string | null
  /** ISO timestamp for timed work, or a Beijing calendar date for untimed completion. */
  end: string | null
  skipped?: boolean
  settled: boolean
  popped: boolean
  slot: number | null
  returned: string | null
  sun: number
  water: number
  stages: number[]
  audit: { at: string; previousStart: string | null; previousEnd: string | null }[]
}

/** P0、P1 是今天要做，计入今日目标。P2 及以后可以挪到下一天。 */
export function isMustDo(priority: string): boolean {
  return priority === 'P0' || priority === 'P1'
}

export interface DiaryNote {
  id: string
  t: string
  icon: string
  text: string
}

export interface Rules {
  chinese: number
  math: number
  english: number
  wish: number
}
export const defaultRules: Rules = { chinese: 7, math: 4, english: 3, wish: 4 }

export interface TreeData {
  mathQuestionProgress?: Record<string, { firstId: string; throughDay: string; completed: string[] }>
  practiceProgress?: Record<string, PracticeProgress>
  today: string
  firstDay: string
  afterSchool: boolean
  steps: WorkStep[]
  /** Unstarted weekend occurrences excluded by their daily template; retain notes for re-enabling. */
  weekendExcludedSteps?: WorkStep[]
  apples: Apple[]
  stones: Record<SubjectKey, number>
  remainder: Record<CoreSubject, number>
  appleCount: number
  rules: Rules
  ruleHistory: { day: string; rules: Rules }[]
  upcoming: { day: string; rules: Rules } | null
  sun: number
  water: number
  /** 连续有完成记录的天数 */
  streak?: number
  /** 最近一次真正做完作业的日期 */
  lastDoneDay?: string | null
  /** 今日目标奖励已发放的日期 */
  goalAwardedOn?: string | null
  /** Server-issued once per day; persists after the rainbow is picked. */
  dailyRainbowDay?: string
  diary?: DiaryNote[]
  exchanges: string[]
  boxReady: boolean
  lastBox: string | null
  prize: { name: string; ticket: string } | null
}

export type ActionKind =
  | 'sync'
  | 'regenerate'
  | 'addCrown'
  | 'preparePractice'
  | 'school'
  | 'start'
  | 'collectFlowers'
  | 'editMathQuestion'
  | 'answerHomeworkQuestion'
  | 'finish'
  | 'completeUntimed'
  | 'skip'
  | 'pop'
  | 'return'
  | 'move'
  | 'nextDay'
  | 'record'
  | 'saveNotes'
  | 'water'
  | 'magic'
  | 'pick'
  | 'exchange'
  | 'settings'
  | 'openBox'
  | 'acceptBox'
export interface TreeAction {
  kind: ActionKind
  name?: string
  flowerSelection?: { position: number; complete: boolean }
  questionEdit?: 'complete' | 'undo' | 'append' | 'remove'
  rowId?: string
  problemId?: string
  popOnFinish?: boolean
  regenerate?: { from: string; through: string; expectedCount: number }
  notes?: { id: string; previous: string; value: string }[]
  id?: string
  day?: string | null
  start?: string
  end?: string
  color?: CoreSubject
  rules?: Rules
  pin?: string
}
export interface Snapshot {
  clockOffsetMs?: number
  revision: number
  tree: TreeData
}

export const timeZone = 'Asia/Shanghai'
const dates = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export function dayOf(value: string | Date) {
  return dates.format(new Date(value instanceof Date ? value.getTime() : value))
}
export function shift(day: string, n: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}
export function elapsed(start: string, end: string) {
  return Math.ceil((Date.parse(end) - Date.parse(start)) / 60000)
}
export function clock(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
export function timing(step: WorkStep) {
  if (!step.end) return ''
  if (step.flowers) return step.flowers.complete ? '整份做完' : '本次已收工'
  if (!step.start) return '已完成 · 未计时'
  const delta = elapsed(step.start, step.end) - step.minutes
  return delta === 0 ? '按时完成' : delta < 0 ? `提前 ${-delta} 分钟` : `超时 ${delta} 分钟`
}

export const SUN_MAGIC_COST = 8

export function canGrowWithSun(step: WorkStep) {
  return !!step.end && step.popped && !step.settled && step.stages.some(stage => stage < 3)
}
