export interface ModuleCardData {
  href: string
  title: string
  description: string
  tag: string
  variant: 'math' | 'english'
  stats: string[]
  enterText: string
  icon: string
}

export interface CourseCardData {
  href: string
  title: string
  description: string
  icon: string
  lectureNum: string
  tags: string[]
  variant: 'blue' | 'amber' | 'violet'
}

export type FruitItem = {
  emoji: string
  name: string
}

export type Lesson34Mode = 'merge' | 'split'

export interface RatioInput {
  id: string
  ans: number
  unit?: string
}

export interface OpInput {
  id: string
  ans: string
}

export type RatioColValue = string | RatioInput

export interface DualSceneConfig {
  initA: number
  unitA: string
  targetA: number
  initB: number
  unitB: string
  targetB: number
  totalBase: number
  unitC: string
  labelA: string
  labelB: string
  labelC: string
  isReverse?: boolean
  targetTotal?: number
  guiALabel?: string
  guiBLabel?: string
  expALabel?: string
  expBLabel?: string
}

export interface BlockScene {
  init: number
  perPart: number
  unit: number
  target: number
  total: number
  answer?: number
  rightUnit?: string
  leftUnit?: string
  leftLabel?: string
  rightLabel?: string
  hint?: string
  expandUnit?: string
}

export interface Problem {
  id: string
  title: string
  tag: string
  tagLabel: string
  text: string
  analysis: string[]
  type: 'ratio3' | 'ratio3b'
  rows: (string | RatioInput)[]
  rows2?: (string | RatioInput)[]
  rcols: RatioColValue[]
  ops: OpInput[]
  hasBlocks: boolean
  blockScene?: BlockScene
  dualSc?: DualSceneConfig
  finalQ: string
  finalUnit: string
  finalAns: number
}

export interface ProblemSet {
  pretest: Problem[]
  lesson: Problem[]
  homework: Problem[]
  workbook: Problem[]
}

export type PageName = 'home' | 'lesson' | 'homework' | 'workbook' | 'alltest' | 'pretest' | 'detail'

export interface WordEntry {
  unit: string
  lesson: string
  word: string
  explanation: string
  ipa?: string
  example?: string
  phonics?: string
}

export type QuizType = 'wordToMeaning' | 'meaningToWord' | 'spelling'

export interface DailyRecord {
  date: string
  newWords: string[]
  reviews: string[]
  scores: Record<string, number>
}
