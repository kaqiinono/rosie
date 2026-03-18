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
  GUIYI_SOLVED: 'guiyi-solved',
  GUIYI_SIDEBAR_COLLAPSED: 'guiyi-sidebar-collapsed',
  WORD_DATA: 'rosie-words',
  DAILY_DATA: 'rosie-daily',
} as const

export const NAV_PAGES = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'lesson', icon: '📖', label: '课堂' },
  { key: 'homework', icon: '✏️', label: '课后' },
  { key: 'workbook', icon: '📚', label: '练习册' },
  { key: 'alltest', icon: '🎯', label: '题库' },
  { key: 'pretest', icon: '📝', label: '课前测' },
] as const

export const SOURCE_LABELS: Record<string, string> = {
  lesson: '📖 课堂',
  homework: '✏️ 课后',
  workbook: '📚 练习册',
  pretest: '📝 课前测',
}

export const PRICES = [5, 8, 10, 12, 15, 20, 25, 30, 50]
export const SMALL_NUMS = [2, 3, 4, 5, 6, 7, 8, 9]
