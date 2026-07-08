import {
  PROBLEMS as G1Lesson12PROBLEMS,
  PROBLEM_TYPES as G1Lesson12PT,
  TAG_STYLE as G1Lesson12TS,
} from './g1/lesson12-data'
import {
  PROBLEMS as G1Lesson13PROBLEMS,
  PROBLEM_TYPES as G1Lesson13PT,
  TAG_STYLE as G1Lesson13TS,
} from './g1/lesson13-data'
import {
  PROBLEMS as G1Lesson15PROBLEMS,
  PROBLEM_TYPES as G1Lesson15PT,
  TAG_STYLE as G1Lesson15TS,
} from './g1/lesson15-data'
import {
  PROBLEMS as G1Lesson18PROBLEMS,
  PROBLEM_TYPES as G1Lesson18PT,
  TAG_STYLE as G1Lesson18TS,
} from './g1/lesson18-data'
import {
  PROBLEMS as G1Lesson23PROBLEMS,
  PROBLEM_TYPES as G1Lesson23PT,
  TAG_STYLE as G1Lesson23TS,
} from './g1/lesson23-data'
import {
  PROBLEMS as G1Lesson29PROBLEMS,
  PROBLEM_TYPES as G1Lesson29PT,
  TAG_STYLE as G1Lesson29TS,
} from './g1/lesson29-data'
import {
  PROBLEMS as G1Lesson30PROBLEMS,
  PROBLEM_TYPES as G1Lesson30PT,
  TAG_STYLE as G1Lesson30TS,
} from './g1/lesson30-data'
import {
  PROBLEMS as G1Lesson34PROBLEMS,
  PROBLEM_TYPES as G1Lesson34PT,
  TAG_STYLE as G1Lesson34TS,
} from './g1/lesson34-data'
import {
  PROBLEMS as G1Lesson35PROBLEMS,
  PROBLEM_TYPES as G1Lesson35PT,
  TAG_STYLE as G1Lesson35TS,
} from './g1/lesson35-data'
import {
  PROBLEMS as G1Lesson36PROBLEMS,
  PROBLEM_TYPES as G1Lesson36PT,
  TAG_STYLE as G1Lesson36TS,
} from './g1/lesson36-data'
import {
  PROBLEMS as G1Lesson37PROBLEMS,
  PROBLEM_TYPES as G1Lesson37PT,
  TAG_STYLE as G1Lesson37TS,
} from './g1/lesson37-data'
import {
  PROBLEMS as G1Lesson38PROBLEMS,
  PROBLEM_TYPES as G1Lesson38PT,
  TAG_STYLE as G1Lesson38TS,
} from './g1/lesson38-data'
import {
  PROBLEMS as G1Lesson39PROBLEMS,
  PROBLEM_TYPES as G1Lesson39PT,
  TAG_STYLE as G1Lesson39TS,
} from './g1/lesson39-data'
import {
  PROBLEMS as G1Lesson40PROBLEMS,
  PROBLEM_TYPES as G1Lesson40PT,
  TAG_STYLE as G1Lesson40TS,
} from './g1/lesson40-data'
import {
  PROBLEMS as G1Lesson41PROBLEMS,
  PROBLEM_TYPES as G1Lesson41PT,
  TAG_STYLE as G1Lesson41TS,
} from './g1/lesson41-data'
import {
  PROBLEMS as G1Lesson42PROBLEMS,
  PROBLEM_TYPES as G1Lesson42PT,
  TAG_STYLE as G1Lesson42TS,
} from './g1/lesson42-data'
import {
  PROBLEMS as G1Lesson43PROBLEMS,
  PROBLEM_TYPES as G1Lesson43PT,
  TAG_STYLE as G1Lesson43TS,
} from './g1/lesson43-data'
import {
  PROBLEMS as G1Lesson44PROBLEMS,
  PROBLEM_TYPES as G1Lesson44PT,
  TAG_STYLE as G1Lesson44TS,
} from './g1/lesson44-data'
import {
  PROBLEMS as G1Lesson46PROBLEMS,
  PROBLEM_TYPES as G1Lesson46PT,
  TAG_STYLE as G1Lesson46TS,
} from './g1/lesson46-data'
import {
  PROBLEMS as G1Lesson47PROBLEMS,
  PROBLEM_TYPES as G1Lesson47PT,
  TAG_STYLE as G1Lesson47TS,
} from './g1/lesson47-data'
import { PROBLEMS as G2Lesson1PROBLEMS, PROBLEM_TYPES as G2Lesson1PT, TAG_STYLE as G2Lesson1TS } from './g2/lesson1-data'
import { PROBLEMS as G2Lesson6PROBLEMS, PROBLEM_TYPES as G2Lesson6PT, TAG_STYLE as G2Lesson6TS } from './g2/lesson6-data'
import { PROBLEMS as G2Lesson7PROBLEMS, PROBLEM_TYPES as G2Lesson7PT, TAG_STYLE as G2Lesson7TS } from './g2/lesson7-data'
import { PROBLEMS as G2Lesson5PROBLEMS, PROBLEM_TYPES as G2Lesson5PT, TAG_STYLE as G2Lesson5TS } from './g2/lesson5-data'
import { PROBLEMS as G2Lesson4PROBLEMS, PROBLEM_TYPES as G2Lesson4PT, TAG_STYLE as G2Lesson4TS } from './g2/lesson4-data'
import { PROBLEMS as G2Lesson3PROBLEMS, PROBLEM_TYPES as G2Lesson3PT, TAG_STYLE as G2Lesson3TS } from './g2/lesson3-data'
import { PROBLEMS as G2Lesson2PROBLEMS, PROBLEM_TYPES as G2Lesson2PT, TAG_STYLE as G2Lesson2TS } from './g2/lesson2-data'
import type { Problem, ProblemSet } from '@rosie/core'
import { lessonByKey, routeForLesson } from '@rosie/math/utils/lesson-registry'

export interface SeaLessonMeta {
  id: string
  title: string
  shortTitle: string
  icon: string
  badgeClass: string // tailwind classes for lesson badge
  tagStyle: Record<string, string>
  types: { tag: string; label: string }[]
  problems: ProblemSet
}

export const SEA_LESSONS: SeaLessonMeta[] = [
  {
    id: '1-12',
    title: '第12讲·巧算加减法进阶',
    shortTitle: '12·巧算加减',
    icon: '🔢',
    badgeClass: 'bg-orange-100 text-orange-700',
    tagStyle: G1Lesson12TS,
    types: G1Lesson12PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson12PROBLEMS,
  },
  {
    id: '1-13',
    title: '第13讲·植树问题',
    shortTitle: '13·植树问题',
    icon: '🌳',
    badgeClass: 'bg-green-100 text-green-700',
    tagStyle: G1Lesson13TS,
    types: G1Lesson13PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson13PROBLEMS,
  },
  {
    id: '1-15',
    title: '第15讲·和差问题',
    shortTitle: '15·和差问题',
    icon: '➕',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: G1Lesson15TS,
    types: G1Lesson15PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson15PROBLEMS,
  },
  {
    id: '1-18',
    title: '第18讲·和差倍初步',
    shortTitle: '18·和差倍初步',
    icon: '✖️',
    badgeClass: 'bg-purple-100 text-purple-700',
    tagStyle: G1Lesson18TS,
    types: G1Lesson18PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson18PROBLEMS,
  },
  {
    id: '1-23',
    title: '第23讲·逻辑推理',
    shortTitle: '23·逻辑推理',
    icon: '🔍',
    badgeClass: 'bg-violet-100 text-violet-700',
    tagStyle: G1Lesson23TS,
    types: G1Lesson23PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson23PROBLEMS,
  },
  {
    id: '1-29',
    title: '第29讲·算符大作战',
    shortTitle: '29·算符大作战',
    icon: '🎮',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: G1Lesson29TS,
    types: G1Lesson29PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson29PROBLEMS,
  },
  {
    id: '1-30',
    title: '第30讲·和差倍进阶',
    shortTitle: '30·和差倍进阶',
    icon: '🧮',
    badgeClass: 'bg-amber-100 text-amber-700',
    tagStyle: G1Lesson30TS,
    types: G1Lesson30PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson30PROBLEMS,
  },
  {
    id: '1-34',
    title: '第34讲·乘法技巧',
    shortTitle: '34·乘法技巧',
    icon: '🎁',
    badgeClass: 'bg-violet-100 text-violet-700',
    tagStyle: G1Lesson34TS,
    types: G1Lesson34PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson34PROBLEMS,
  },
  {
    id: '1-35',
    title: '第35讲·归一问题',
    shortTitle: '35·归一问题',
    icon: '🎯',
    badgeClass: 'bg-blue-100 text-blue-700',
    tagStyle: G1Lesson35TS,
    types: G1Lesson35PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson35PROBLEMS,
  },
  {
    id: '1-36',
    title: '第36讲·星期几问题',
    shortTitle: '36·星期几',
    icon: '📅',
    badgeClass: 'bg-amber-100 text-amber-700',
    tagStyle: G1Lesson36TS,
    types: G1Lesson36PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson36PROBLEMS,
  },
  {
    id: '1-37',
    title: '第37讲·鸡兔同笼',
    shortTitle: '37·鸡兔同笼',
    icon: '🐔',
    badgeClass: 'bg-orange-100 text-orange-700',
    tagStyle: G1Lesson37TS,
    types: G1Lesson37PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson37PROBLEMS,
  },
  {
    id: '1-38',
    title: '第38讲·一笔画',
    shortTitle: '38·一笔画',
    icon: '✏️',
    badgeClass: 'bg-purple-100 text-purple-700',
    tagStyle: G1Lesson38TS,
    types: G1Lesson38PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson38PROBLEMS,
  },
  {
    id: '1-39',
    title: '第39讲·盈亏问题',
    shortTitle: '39·盈亏',
    icon: '⚖️',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: G1Lesson39TS,
    types: G1Lesson39PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson39PROBLEMS,
  },
  {
    id: '1-40',
    title: '第40讲·周长问题',
    shortTitle: '40·周长',
    icon: '📐',
    badgeClass: 'bg-green-100 text-green-700',
    tagStyle: G1Lesson40TS,
    types: G1Lesson40PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson40PROBLEMS,
  },
  {
    id: '1-41',
    title: '第41讲·间隔趣题',
    shortTitle: '41·间隔趣题',
    icon: '✂️',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: G1Lesson41TS,
    types: G1Lesson41PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson41PROBLEMS,
  },
  {
    id: '1-42',
    title: '第42讲·生活智力题',
    shortTitle: '42·生活智力',
    icon: '🧠',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: G1Lesson42TS,
    types: G1Lesson42PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson42PROBLEMS,
  },
  {
    id: '1-43',
    title: '第43讲·等差数列初识',
    shortTitle: '43·等差数列',
    icon: '📊',
    badgeClass: 'bg-cyan-100 text-cyan-700',
    tagStyle: G1Lesson43TS,
    types: G1Lesson43PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson43PROBLEMS,
  },
  {
    id: '1-44',
    title: '第44讲·统筹优化',
    shortTitle: '44·统筹优化',
    icon: '⏱️',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    tagStyle: G1Lesson44TS,
    types: G1Lesson44PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson44PROBLEMS,
  },
  {
    id: '1-46',
    title: '第46讲·抽屉原理与最不利',
    shortTitle: '46·抽屉·最不利',
    icon: '🗄️',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: G1Lesson46TS,
    types: G1Lesson46PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson46PROBLEMS,
  },
  {
    id: '1-47',
    title: '第47讲·方格中的秘密',
    shortTitle: '47·方格谜题',
    icon: '🧩',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700',
    tagStyle: G1Lesson47TS,
    types: G1Lesson47PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G1Lesson47PROBLEMS,
  },
  {
    id: '2-2',
    title: '第2讲·基本应用题',
    shortTitle: '2·基本应用题',
    icon: '📝',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: G2Lesson2TS,
    types: G2Lesson2PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson2PROBLEMS,
  },
  {
    id: '2-1',
    title: '第1讲·加减法速算与巧算',
    shortTitle: '1·速算巧算',
    icon: '🧮',
    badgeClass: 'bg-rose-100 text-rose-700',
    tagStyle: G2Lesson1TS,
    types: G2Lesson1PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson1PROBLEMS,
  },
  {
    id: '2-7',
    title: '第7讲·数字谜',
    shortTitle: '7·数字谜',
    icon: '🔐',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: G2Lesson7TS,
    types: G2Lesson7PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson7PROBLEMS,
  },
  {
    id: '2-6',
    title: '第6讲·简单枚举',
    shortTitle: '6·简单枚举',
    icon: '🔢',
    badgeClass: 'bg-teal-100 text-teal-700',
    tagStyle: G2Lesson6TS,
    types: G2Lesson6PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson6PROBLEMS,
  },
  {
    id: '2-5',
    title: '第5讲·找规律',
    shortTitle: '5·找规律',
    icon: '🔮',
    badgeClass: 'bg-amber-100 text-amber-700',
    tagStyle: G2Lesson5TS,
    types: G2Lesson5PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson5PROBLEMS,
  },
  {
    id: '2-4',
    title: '第4讲·差倍问题',
    shortTitle: '4·差倍问题',
    icon: '📊',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: G2Lesson4TS,
    types: G2Lesson4PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson4PROBLEMS,
  },
  {
    id: '2-3',
    title: '第3讲·等量代换与归一问题',
    shortTitle: '3·代换归一',
    icon: '⚖️',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    tagStyle: G2Lesson3TS,
    types: G2Lesson3PT.map((t) => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: G2Lesson3PROBLEMS,
  },
]

export const SEA_LESSON_MAP: Record<string, SeaLessonMeta> = Object.fromEntries(
  SEA_LESSONS.map((l) => [l.id, l]),
)

export function findSeaLesson(lessonKey: string): SeaLessonMeta | undefined {
  return SEA_LESSON_MAP[lessonKey]
}

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
    const entry = lessonByKey(lesson.id)
    const basePath = entry ? routeForLesson(entry) : `/math/ny/${lesson.id}`
    for (const section of sectionOrder) {
      const list = (lesson.problems as unknown as Record<string, Problem[]>)[section]
      if (!list || list.length === 0) continue
      list.forEach((p, i) => {
        pool.push({
          problem: p,
          lessonId: lesson.id,
          section,
          href: `${basePath}/${section}/${i + 1}`,
        })
      })
    }
  }
  return pool
}

export const SEA_POOL: SeaProblem[] = buildPool()
