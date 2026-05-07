import { PROBLEMS as PROBLEMS34, PROBLEM_TYPES as PT34, TAG_STYLE as TS34 } from './lesson34-data'
import { PROBLEMS as PROBLEMS35, PROBLEM_TYPES as PT35, TAG_STYLE as TS35 } from './lesson35-data'
import { PROBLEMS as PROBLEMS36, PROBLEM_TYPES as PT36, TAG_STYLE as TS36 } from './lesson36-data'
import { PROBLEMS as PROBLEMS37, PROBLEM_TYPES as PT37, TAG_STYLE as TS37 } from './lesson37-data'
import { PROBLEMS as PROBLEMS38, PROBLEM_TYPES as PT38, TAG_STYLE as TS38 } from './lesson38-data'
import { PROBLEMS as PROBLEMS39, PROBLEM_TYPES as PT39, TAG_STYLE as TS39 } from './lesson39-data'
import { PROBLEMS as PROBLEMS41, PROBLEM_TYPES as PT41, TAG_STYLE as TS41 } from './lesson41-data'
import type { Problem, ProblemSet } from './type'

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
    id: '41',
    title: '第41讲·间隔趣题',
    shortTitle: '41·间隔趣题',
    icon: '✂️',
    badgeClass: 'bg-sky-100 text-sky-700',
    tagStyle: TS41,
    types: PT41.map(t => ({ tag: t.tag, label: (t as { tag: string; label: string }).label })),
    problems: PROBLEMS41,
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
