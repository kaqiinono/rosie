import type { FruitItem } from './type'

export const FRUIT_ITEMS: FruitItem[] = [
  { emoji: '🍎', name: '苹果' },
  { emoji: '🍊', name: '橘子' },
  { emoji: '🍇', name: '葡萄' },
  { emoji: '🍓', name: '草莓' },
  { emoji: '🍑', name: '桃子' },
  { emoji: '🥝', name: '猕猴桃' },
]

export const CONFETTI_COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

export const CONGRATS_MESSAGES = [
  { emoji: '🎉', title: '太棒了！', sub: '答对了！继续加油！' },
  { emoji: '⭐', title: '厉害！', sub: '你掌握了这道题！' },
  { emoji: '🏆', title: '满分！', sub: '倍比图画得超棒！' },
  { emoji: '🎯', title: '精准！', sub: '归一法用得很熟练！' },
  { emoji: '🌟', title: '完美！', sub: '你是数学小天才！' },
]

export const STORAGE_KEYS = {
  MATH_SOLVED: 'math-solved',
  MATH_WRONG: 'math-wrong',
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
  WORD_DATA: 'rosie-words',
  DAILY_DATA: 'rosie-daily',
  WORD_MASTERY: 'rosie-word-mastery',
  WEEKLY_PLAN: 'rosie-weekly-plan',
  WEEK_START_DAY: 'rosie-week-start-day',
  WEEKLY_NEW_PER_DAY: 'rosie-weekly-new-per-day',
  MATH_WEEKLY_PLAN: 'rosie-math-weekly-plan',
  PROBLEM_MASTERY: 'rosie-problem-mastery',
  MATH_WEEK_START_DAY: 'rosie-math-week-start-day',
  MATH_WEEKLY_PROBLEMS_PER_DAY: 'rosie-math-weekly-problems-per-day',
  MATH_ROTATING_REVIEW: 'rosie-math-rotating-review',
  MATH_WEEKLY_LESSON_REVIEW: 'rosie-math-weekly-lesson-review',
} as const

export const NAV_PAGES = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'lesson', icon: '📖', label: '课堂' },
  { key: 'homework', icon: '✏️', label: '课后' },
  { key: 'workbook', icon: '📚', label: '练习册' },
  { key: 'alltest', icon: '🎯', label: '题库' },
  { key: 'pretest', icon: '📝', label: '课前测' },
  { key: 'mistakes', icon: '📕', label: '错题本' },
] as const

export const SOURCE_LABELS: Record<string, string> = {
  lesson: '📖 课堂',
  homework: '✏️ 课后',
  workbook: '📚 练习册',
  pretest: '📝 课前测',
  supplement: '📒 补充题',
}

export const PRICES = [5, 8, 10, 12, 15, 20, 25, 30, 50]
export const SMALL_NUMS = [2, 3, 4, 5, 6, 7, 8, 9]
