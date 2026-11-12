import type { Apple, CoreSubject, SubjectKey } from '@/components/tree-demo/garden/model'

export interface WorkStep {
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

export interface Rules {
  chinese: number
  math: number
  english: number
  wish: number
}
export const defaultRules: Rules = { chinese: 7, math: 4, english: 3, wish: 4 }

export interface TreeData {
  today: string
  firstDay: string
  afterSchool: boolean
  steps: WorkStep[]
  apples: Apple[]
  stones: Record<SubjectKey, number>
  remainder: Record<CoreSubject, number>
  appleCount: number
  rules: Rules
  ruleHistory: { day: string; rules: Rules }[]
  upcoming: { day: string; rules: Rules } | null
  sun: number
  water: number
  magicDay: string | null
  exchanges: string[]
  boxReady: boolean
  lastBox: string | null
  prize: { name: string; ticket: string } | null
}

export type ActionKind =
  | 'sync'
  | 'school'
  | 'start'
  | 'finish'
  | 'completeUntimed'
  | 'skip'
  | 'pop'
  | 'return'
  | 'move'
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
  if (!step.start) return '已完成 · 未计时'
  const delta = elapsed(step.start, step.end) - step.minutes
  return delta === 0 ? '按时完成' : delta < 0 ? `提前 ${-delta} 分钟` : `超时 ${delta} 分钟`
}
