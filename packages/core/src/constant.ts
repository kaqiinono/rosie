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
  MATH_SIDEBAR_COLLAPSED: 'math-sidebar-collapsed',
  ENGLISH_SEL_STAGE: 'english-sel-stage',
  ENGLISH_SEL_UNITS: 'english-sel-units',
  ENGLISH_SEL_LESSONS: 'english-sel-lessons',
  WEEKLY_PLAN_LAST_LESSONS: 'weekly-plan-last-lessons',
  /** 创建多日计划时上次选择的词库（stage）集合，下次进入直接预选 */
  WEEKLY_PLAN_LAST_STAGES: 'weekly-plan-last-stages',
  /** Session 中间态：拯救队列。仅当前 session 有效，phase=done 时清除。spec §11.6 例外 */
  RESCUE_QUEUE: 'rescue_queue_v1',
  /** 管理后台「草稿词库」：新建但还没写入单词的 stage 名（按 user.id 分 key 持久化） */
  ADMIN_DRAFT_STAGES: 'admin-draft-stages',
  /** 打开绘本详情后是否自动播放讲解音频（默认开） */
  FLIPBOOK_AUTO_PLAY: 'flipbook-auto-play',
  /** 阅读时右上角显示当前页词汇释义（默认开） */
  FLIPBOOK_WORD_OVERLAY: 'flipbook-word-overlay',
  /** 生字库页单元/课文筛选（实际 key 为 `${CHINESE_CHARS_FILTER}:${bookSlug}`） */
  CHINESE_CHARS_FILTER: 'chinese-chars-filter',
  /** 数学管理后台讲次/来源/题型筛选，下次进入恢复上次选择 */
  ADMIN_MATH_LESSON_FILTER: 'admin-math-lesson-filter',
  /** 数学连续练习：是否默认沉浸式（草稿纸）答题 */
  MATH_PRACTICE_IMMERSIVE: 'math-practice-immersive',
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

/** Returns today's date as YYYY-MM-DD. Used across math/english weekly planners. */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Shared Thursday-start (startDay=4) week convention used by both the math and
// English weekly-plan systems. Returns the local YYYY-MM-DD of the week's start.
export function getWeekStart(date?: Date, startDay = 4): string {
  const d = date ? new Date(date) : new Date()
  const daysBack = (d.getDay() - startDay + 7) % 7
  d.setDate(d.getDate() - daysBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const PRICES = [5, 8, 10, 12, 15, 20, 25, 30, 50]
export const SMALL_NUMS = [2, 3, 4, 5, 6, 7, 8, 9]

// ── 去挫败感文案池（spec §10） ────────────────────────────────
export const RETRY_MC_MESSAGES = [
  '💡 差一点点就对啦，再看看？',
  '🔮 这个宝箱没打开，再点一个试试！',
  '✨ 嗯——再瞅一眼，你已经很接近啦！',
] as const

export const RETRY_SPELL_MESSAGES = [
  '💡 差几个字母~ 黄色的字母飞回去了，再拖一次！',
  '🌟 绿色的对啦！再调整一下其他几个？',
  '🧩 拼图差一点点就完整啦，再试一次！',
] as const

export const EATEN_TITLE_MESSAGES = [
  '😱 {word} 被遗忘小怪兽 {name} 吃掉啦！',
  '🙀 哎呀！{word} 跑到 {name} 肚子里啦！',
  '😵 噢呜~ {name} 把 {word} 偷走啦！',
] as const

export const EATEN_SUB_MESSAGES = [
  '加入拯救清单，等会儿一起救它回来！🧡',
  '别担心，我们会在闯关结束前救回它的！⚔️',
  '记住它的样子，等会儿要靠你拯救！🦸',
] as const

export const RESCUE_SAVED_MESSAGES = [
  '🎉 太棒了！你把 {word} 从 {name} 嘴里救回来了！',
  '✨ {word} 自由啦！{name} 灰溜溜地走了~',
  '💪 拯救成功！{word} 回到了你的词汇宝箱里！',
] as const

export const RESCUE_LOST_MESSAGES = [
  '🌙 这次没救回来也没关系，小怪兽答应等你晚点再来挑战~',
  '🌟 别气馁，{name} 今天比较厉害，明天再打它一顿！',
  '💤 {name} 今天比较强，明天再练练就能打过它！',
] as const

export const READING_RETRY_MESSAGE = '🔮 这个不对，看看别的？'
/**
 * Use with split('{word}') in JSX to wrap the word in <b>:
 *   const [pre, post] = READING_SECOND_WRONG_TEMPLATE.split('{word}')
 *   return <>{pre}<b>{word}</b>{post}</>
 */
export const READING_SECOND_WRONG_TEMPLATE = '🌟 这个是 {word}！记一下~'

/** 从文案池随机选一句，做 {word}/{name} 替换 */
export function pickMessage(
  pool: readonly string[],
  vars: { word?: string; name?: string } = {},
): string {
  const tpl = pool[Math.floor(Math.random() * pool.length)]
  return tpl
    .replace('{word}', vars.word ?? '')
    .replace('{name}', vars.name ?? '')
}
