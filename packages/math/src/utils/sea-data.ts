import { PROBLEMS as PROBLEMS12, PROBLEM_TYPES as PT12, TAG_STYLE as TS12 } from './lesson12-data'
import { PROBLEMS as PROBLEMS13, PROBLEM_TYPES as PT13, TAG_STYLE as TS13 } from './lesson13-data'
import { PROBLEMS as PROBLEMS15, PROBLEM_TYPES as PT15, TAG_STYLE as TS15 } from './lesson15-data'
import { PROBLEMS as PROBLEMS18, PROBLEM_TYPES as PT18, TAG_STYLE as TS18 } from './lesson18-data'
import { PROBLEMS as PROBLEMS23, PROBLEM_TYPES as PT23, TAG_STYLE as TS23 } from './lesson23-data'
import { PROBLEMS as PROBLEMS29, PROBLEM_TYPES as PT29, TAG_STYLE as TS29 } from './lesson29-data'
import { PROBLEMS as PROBLEMS30, PROBLEM_TYPES as PT30, TAG_STYLE as TS30 } from './lesson30-data'
import { PROBLEMS as PROBLEMS34, PROBLEM_TYPES as PT34, TAG_STYLE as TS34 } from './lesson34-data'
import { PROBLEMS as PROBLEMS35, PROBLEM_TYPES as PT35, TAG_STYLE as TS35 } from './lesson35-data'
import { PROBLEMS as PROBLEMS36, PROBLEM_TYPES as PT36, TAG_STYLE as TS36 } from './lesson36-data'
import { PROBLEMS as PROBLEMS37, PROBLEM_TYPES as PT37, TAG_STYLE as TS37 } from './lesson37-data'
import { PROBLEMS as PROBLEMS38, PROBLEM_TYPES as PT38, TAG_STYLE as TS38 } from './lesson38-data'
import { PROBLEMS as PROBLEMS39, PROBLEM_TYPES as PT39, TAG_STYLE as TS39 } from './lesson39-data'
import { PROBLEMS as PROBLEMS40, PROBLEM_TYPES as PT40, TAG_STYLE as TS40 } from './lesson40-data'
import { PROBLEMS as PROBLEMS41, PROBLEM_TYPES as PT41, TAG_STYLE as TS41 } from './lesson41-data'
import { PROBLEMS as PROBLEMS42, PROBLEM_TYPES as PT42, TAG_STYLE as TS42 } from './lesson42-data'
import { PROBLEMS as PROBLEMS43, PROBLEM_TYPES as PT43, TAG_STYLE as TS43 } from './lesson43-data'
import { PROBLEMS as PROBLEMS44, PROBLEM_TYPES as PT44, TAG_STYLE as TS44 } from './lesson44-data'
import { PROBLEMS as PROBLEMS46, PROBLEM_TYPES as PT46, TAG_STYLE as TS46 } from './lesson46-data'
import { PROBLEMS as PROBLEMS47, PROBLEM_TYPES as PT47, TAG_STYLE as TS47 } from './lesson47-data'
import { PROBLEMS as PROBLEMS49, PROBLEM_TYPES as PT49, TAG_STYLE as TS49 } from './lesson49-data'
import { PROBLEMS as PROBLEMS50, PROBLEM_TYPES as PT50, TAG_STYLE as TS50 } from './lesson50-data'
import type { Problem, ProblemSet } from '@rosie/core'

export interface SeaLessonMeta {
  id: string
  title: string
  shortTitle: string
  icon: string
  badgeClass: string  // tailwind classes for lesson badge
  tagStyle: Record<string, string>
  types: { tag: string; label: string }[]
  problems: ProblemSet
}

export const SEA_LESSONS: SeaLessonMeta[] = [
  {
    id: '12',
    title: '第12讲·巧算加减法进阶',
    shortTitle: '12·巧算加减',
    icon: '🔢',
    badgeClass: 'bg-orange-100 text-orange-700',
    tagStyle: TS12,
    types: PT12.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS12,
  },
  {
    id: '13',
    title: '第13讲·植树问题',
    shortTitle: '13·植树问题',
    icon: '🌳',
    badgeClass: 'bg-green-100 text-green-700',
    tagStyle: TS13,
    types: PT13.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS13,
  },
  {
    id: '15',
    title: '第15讲·和差问题',
    shortTitle: '15·和差问题',
    icon: '➕',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: TS15,
    types: PT15.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS15,
  },
  {
    id: '18',
    title: '第18讲·和差倍初步',
    shortTitle: '18·和差倍初步',
    icon: '✖️',
    badgeClass: 'bg-purple-100 text-purple-700',
    tagStyle: TS18,
    types: PT18.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS18,
  },
  {
    id: '23',
    title: '第23讲·逻辑推理',
    shortTitle: '23·逻辑推理',
    icon: '🔍',
    badgeClass: 'bg-violet-100 text-violet-700',
    tagStyle: TS23,
    types: PT23.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS23,
  },
  {
    id: '29',
    title: '第29讲·算符大作战',
    shortTitle: '29·算符大作战',
    icon: '🎮',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: TS29,
    types: PT29.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS29,
  },
  {
    id: '30',
    title: '第30讲·和差倍进阶',
    shortTitle: '30·和差倍进阶',
    icon: '🧮',
    badgeClass: 'bg-amber-100 text-amber-700',
    tagStyle: TS30,
    types: PT30.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS30,
  },
  {
    id: '34',
    title: '第34讲·乘法技巧',
    shortTitle: '34·乘法技巧',
    icon: '🎁',
    badgeClass: 'bg-violet-100 text-violet-700',
    tagStyle: TS34,
    types: PT34.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS34,
  },
  {
    id: '35',
    title: '第35讲·归一问题',
    shortTitle: '35·归一问题',
    icon: '🎯',
    badgeClass: 'bg-blue-100 text-blue-700',
    tagStyle: TS35,
    types: PT35.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS35,
  },
  {
    id: '36',
    title: '第36讲·星期几问题',
    shortTitle: '36·星期几',
    icon: '📅',
    badgeClass: 'bg-amber-100 text-amber-700',
    tagStyle: TS36,
    types: PT36.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS36,
  },
  {
    id: '37',
    title: '第37讲·鸡兔同笼',
    shortTitle: '37·鸡兔同笼',
    icon: '🐔',
    badgeClass: 'bg-orange-100 text-orange-700',
    tagStyle: TS37,
    types: PT37.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS37,
  },
  {
    id: '38',
    title: '第38讲·一笔画',
    shortTitle: '38·一笔画',
    icon: '✏️',
    badgeClass: 'bg-purple-100 text-purple-700',
    tagStyle: TS38,
    types: PT38.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS38,
  },
  {
    id: '39',
    title: '第39讲·盈亏问题',
    shortTitle: '39·盈亏',
    icon: '⚖️',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: TS39,
    types: PT39.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS39,
  },
  {
    id: '40',
    title: '第40讲·周长问题',
    shortTitle: '40·周长',
    icon: '📐',
    badgeClass: 'bg-green-100 text-green-700',
    tagStyle: TS40,
    types: PT40.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS40,
  },
  {
    id: '41',
    title: '第41讲·间隔趣题',
    shortTitle: '41·间隔趣题',
    icon: '✂️',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: TS41,
    types: PT41.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS41,
  },
  {
    id: '42',
    title: '第42讲·生活智力题',
    shortTitle: '42·生活智力',
    icon: '🧠',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: TS42,
    types: PT42.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS42,
  },
  {
    id: '43',
    title: '第43讲·等差数列初识',
    shortTitle: '43·等差数列',
    icon: '📊',
    badgeClass: 'bg-cyan-100 text-cyan-700',
    tagStyle: TS43,
    types: PT43.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS43,
  },
  {
    id: '44',
    title: '第44讲·统筹优化',
    shortTitle: '44·统筹优化',
    icon: '⏱️',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    tagStyle: TS44,
    types: PT44.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS44,
  },
  {
    id: '46',
    title: '第46讲·抽屉原理与最不利',
    shortTitle: '46·抽屉·最不利',
    icon: '🗄️',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: TS46,
    types: PT46.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS46,
  },
  {
    id: '47',
    title: '第47讲·方格中的秘密',
    shortTitle: '47·方格谜题',
    icon: '🧩',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700',
    tagStyle: TS47,
    types: PT47.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS47,
  },
  {
    id: '50',
    title: '第2讲·等量代换与归一问题',
    shortTitle: '2·归一问题',
    icon: '⚖️',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: TS50,
    types: PT50.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS50,
  },
  {
    id: '49',
    title: '第1讲·加减法速算与巧算',
    shortTitle: '1·速算巧算',
    icon: '🧮',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: TS49,
    types: PT49.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS49,
  },
]

export const SEA_LESSON_MAP: Record<string, SeaLessonMeta> = Object.fromEntries(
  SEA_LESSONS.map(l => [l.id, l])
)

export interface SeaProblem {
  problem: Problem
  lessonId: string
  section: string
  href: string
}

function buildPool(): SeaProblem[] {
  const pool: SeaProblem[] = []
  const sectionOrder = ['pretest', 'lesson', 'homework', 'workbook', 'supplement']
  for (const lesson of SEA_LESSONS) {
    for (const section of sectionOrder) {
      const list = (lesson.problems as unknown as Record<string, Problem[]>)[section]
      if (!list || list.length === 0) continue
      list.forEach((p, i) => {
        pool.push({
          problem: p,
          lessonId: lesson.id,
          section,
          href: `/math/ny/${lesson.id}/${section}/${i + 1}`,
        })
      })
    }
  }
  return pool
}

export const SEA_POOL: SeaProblem[] = buildPool()
