import type {
  TreeId,
  LevelId,
  TreeConfig,
  LevelConfig,
  TierConfig,
  Tier,
  QuestionType,
} from './calculate-types'

// ─── 三档通关条件 ──────────────────────────────────────────────────────

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  beginner: {
    tier: 'beginner',
    questionCount: 15,
    passRate: 0.7,
    hasTimeLimit: false,
    includesVariants: false,
  },
  advanced: {
    tier: 'advanced',
    questionCount: 20,
    passRate: 0.8,
    hasTimeLimit: false,
    includesVariants: true,
  },
  challenge: {
    tier: 'challenge',
    questionCount: 25,
    passRate: 0.85,
    hasTimeLimit: true,
    includesVariants: true,
  },
}

// ─── 首通奖励 ──────────────────────────────────────────────────────────

export const FIRST_CLEAR_BONUS: Record<Tier, number> = {
  beginner: 20,
  advanced: 30,
  challenge: 50,
}

// ─── Helper ───────────────────────────────────────────────────────────

function lv(
  tree: TreeId,
  n: number,
  name: string,
  description: string,
  starsPerQuestion: number,
  bankSize: number,
  questionTypes: QuestionType[],
): LevelConfig {
  const id = `${tree}-${n}` as LevelId
  const prevLevel = n > 1 ? (`${tree}-${n - 1}` as LevelId) : null
  return { id, name, description, starsPerQuestion, bankSize, questionTypes, prevLevel }
}

// ─── NS 数感基础 ──────────────────────────────────────────────────────

const NS_LEVELS: LevelConfig[] = [
  { id: 'NS-1', name: '数的大小比较', description: '两数比大小、三数排序 (1~100)', starsPerQuestion: 1, bankSize: 50, questionTypes: ['choice'], prevLevel: null },
  { id: 'NS-2', name: '数位认知', description: '个十百千位读写、数的组成', starsPerQuestion: 1, bankSize: 50, questionTypes: ['choice', 'fill'], prevLevel: null },
  { id: 'NS-3', name: '估算与近似', description: '凑十凑百、四舍五入', starsPerQuestion: 2, bankSize: 40, questionTypes: ['choice'], prevLevel: null },
  { id: 'NS-4', name: '数轴与数感', description: '在数轴上定位整数和分数', starsPerQuestion: 2, bankSize: 40, questionTypes: ['number_line'], prevLevel: null },
]

// ─── AS 加减法 ────────────────────────────────────────────────────────

const AS_LEVELS: LevelConfig[] = [
  lv('AS', 1, '10以内加减', '0~10 的加法和减法', 1, 45, ['choice', 'fill']),
  lv('AS', 2, '20以内不进位加减', '不涉及进位退位', 1, 50, ['choice', 'fill']),
  lv('AS', 3, '20以内进退位加减', '含进位加法和退位减法', 1, 60, ['choice', 'fill']),
  lv('AS', 4, '100以内不进位加减', '整十数加减、不进位', 2, 80, ['choice', 'fill']),
  lv('AS', 5, '100以内进退位加减', '含多次进位退位', 2, 80, ['choice', 'fill', 'vertical']),
  lv('AS', 6, '1000以内加减', '三位数加减法', 2, 100, ['vertical', 'fill']),
  lv('AS', 7, '万以内+连加连减', '四位数、连续运算', 3, 100, ['vertical', 'fill']),
]

// ─── MU 乘法 ──────────────────────────────────────────────────────────

const MU_LEVELS: LevelConfig[] = [
  lv('MU', 1, '×1, ×2, ×5', '简单因数乘法表', 2, 27, ['choice', 'fill']),
  lv('MU', 2, '×3, ×4', '中等因数', 2, 18, ['choice', 'fill']),
  lv('MU', 3, '×6, ×7', '较难因数', 2, 18, ['choice', 'fill']),
  lv('MU', 4, '×8, ×9', '高难因数', 2, 18, ['choice', 'fill']),
  lv('MU', 5, '九九综合', '全表混合', 2, 81, ['choice', 'fill']),
  lv('MU', 6, '两位数×一位数', '如 47×6', 3, 80, ['vertical', 'fill']),
  lv('MU', 7, '两位数×两位数', '如 34×27', 4, 80, ['vertical', 'fill']),
]

// ─── DI 除法 ──────────────────────────────────────────────────────────

const DI_LEVELS: LevelConfig[] = [
  lv('DI', 1, '÷1, ÷2, ÷5', '简单除数', 2, 27, ['choice', 'fill']),
  lv('DI', 2, '÷3, ÷4', '中等除数', 2, 18, ['choice', 'fill']),
  lv('DI', 3, '÷6~÷9', '较大除数', 2, 36, ['choice', 'fill']),
  lv('DI', 4, '表内除法综合', '全表混合', 2, 81, ['choice', 'fill']),
  lv('DI', 5, '有余数除法', '如 23÷5=4…3', 3, 60, ['choice', 'fill']),
  lv('DI', 6, '多位数÷一位数', '如 468÷6', 3, 80, ['vertical', 'fill']),
]

// ─── MX 四则混合 ──────────────────────────────────────────────────────

const MX_LEVELS: LevelConfig[] = [
  lv('MX', 1, '两步加减混合', '12 + 8 - 5 = ?', 3, 60, ['choice', 'fill']),
  lv('MX', 2, '两步含乘除', '3 + 4 × 5 = ? 先乘除后加减', 3, 60, ['choice', 'fill']),
  lv('MX', 3, '带小括号两步', '(3 + 4) × 5 = ?', 3, 60, ['choice', 'fill', 'equation_fill']),
  lv('MX', 4, '三步混合运算', '12 + 6 × 3 - 8 = ?', 4, 80, ['fill']),
  lv('MX', 5, '带括号三步', '(8 + 4) × (15 - 9) = ?', 4, 80, ['fill']),
  lv('MX', 6, '简便运算', '交换律/结合律/分配律', 4, 60, ['choice', 'fill', 'equation_fill']),
]

// ─── DE 小数 ──────────────────────────────────────────────────────────

const DE_LEVELS: LevelConfig[] = [
  lv('DE', 1, '一位小数加减', '3.5 + 2.8 = ?', 3, 60, ['choice', 'fill']),
  lv('DE', 2, '两位小数加减', '4.56 + 3.78 = ?', 3, 60, ['choice', 'fill']),
  lv('DE', 3, '小数×整数', '2.5 × 4 = ?', 3, 60, ['vertical', 'fill']),
  lv('DE', 4, '小数×小数', '1.2 × 0.5 = ?', 4, 60, ['vertical', 'fill']),
  lv('DE', 5, '小数÷整数', '7.5 ÷ 3 = ?', 4, 60, ['vertical', 'fill']),
  lv('DE', 6, '小数÷小数', '3.6 ÷ 1.2 = ?', 4, 60, ['vertical', 'fill']),
]

// ─── FR 分数 ──────────────────────────────────────────────────────────

const FR_LEVELS: LevelConfig[] = [
  lv('FR', 1, '同分母加减', '2/5 + 1/5 = ?', 3, 40, ['fraction_vis', 'choice', 'fill']),
  lv('FR', 2, '异分母简单加减', '1/2 + 1/3 = ?', 3, 50, ['fraction_vis', 'choice', 'fill']),
  lv('FR', 3, '异分母综合加减', '3/4 - 2/7 = ?', 4, 60, ['fill']),
  lv('FR', 4, '分数×整数', '2/3 × 6 = ?', 4, 50, ['choice', 'fill']),
  lv('FR', 5, '分数×分数', '2/3 × 3/4 = ?', 4, 50, ['fill']),
  lv('FR', 6, '分数÷整数', '3/4 ÷ 2 = ?', 4, 50, ['fill']),
  lv('FR', 7, '分数÷分数', '2/3 ÷ 4/5 = ?', 5, 50, ['fill']),
]

// ─── PC 百分数 ────────────────────────────────────────────────────────

const PC_LEVELS: LevelConfig[] = [
  lv('PC', 1, '互化', '3/4 = ?%、0.6 = ?%', 3, 40, ['choice', 'fill']),
  lv('PC', 2, '百分数计算', '200 的 15% 是多少？', 4, 50, ['choice', 'fill']),
  lv('PC', 3, '折扣/利率', '原价 80 元打八折是多少？', 5, 40, ['choice', 'step_solve']),
]

// ─── NG 负数 ──────────────────────────────────────────────────────────

const NG_LEVELS: LevelConfig[] = [
  lv('NG', 1, '负数加减', '(-3) + 5 = ?', 3, 50, ['number_line', 'choice', 'fill']),
  lv('NG', 2, '负数乘除', '(-4) × (-3) = ?', 4, 50, ['choice', 'fill']),
  lv('NG', 3, '有理数混合', '(-2) + 3 × (-4) = ?', 5, 60, ['fill']),
  lv('NG', 4, '绝对值运算', '|(-5) + 3| = ?', 4, 40, ['choice', 'fill']),
]

// ─── PW 幂与根 ────────────────────────────────────────────────────────

const PW_LEVELS: LevelConfig[] = [
  lv('PW', 1, '平方与立方', '7² = ?、3³ = ?', 4, 50, ['choice', 'fill']),
  lv('PW', 2, '幂运算规则', '2³ × 2⁴ = 2^?', 5, 40, ['choice', 'fill']),
  lv('PW', 3, '开方基础', '√49 = ?、³√27 = ?', 5, 40, ['choice', 'fill']),
]

// ─── AP 综合应用 ──────────────────────────────────────────────────────

const AP_LEVELS: LevelConfig[] = [
  lv('AP', 1, '整数应用题', '两步整数文字题', 4, 40, ['step_solve']),
  lv('AP', 2, '小数/分数应用题', '含小数或分数的文字题', 5, 40, ['step_solve']),
  lv('AP', 3, '多步综合应用', '三步以上，混合类型', 5, 40, ['step_solve']),
  lv('AP', 4, '挑战：开放题', '一题多解、最优解', 6, 30, ['step_solve']),
]

// ─── 11 条技能树 ──────────────────────────────────────────────────────

export const SKILL_TREES: TreeConfig[] = [
  {
    id: 'NS',
    name: '数感基础',
    icon: '🟢',
    color: 'emerald',
    levels: NS_LEVELS,
    prerequisites: [],
  },
  {
    id: 'AS',
    name: '加减法',
    icon: '🟡',
    color: 'amber',
    levels: AS_LEVELS,
    prerequisites: ['NS-2'],
  },
  {
    id: 'MU',
    name: '乘法',
    icon: '🔵',
    color: 'blue',
    levels: MU_LEVELS,
    prerequisites: ['AS-3'],
  },
  {
    id: 'DI',
    name: '除法',
    icon: '🔵',
    color: 'sky',
    levels: DI_LEVELS,
    prerequisites: ['MU-5'],
  },
  {
    id: 'MX',
    name: '四则混合',
    icon: '🟠',
    color: 'orange',
    levels: MX_LEVELS,
    prerequisites: ['AS-5', 'MU-5', 'DI-3'],
  },
  {
    id: 'DE',
    name: '小数',
    icon: '🟣',
    color: 'purple',
    levels: DE_LEVELS,
    prerequisites: ['AS-5', 'MU-6'],
  },
  {
    id: 'FR',
    name: '分数',
    icon: '🔴',
    color: 'rose',
    levels: FR_LEVELS,
    prerequisites: ['MU-5', 'DI-3'],
  },
  {
    id: 'PC',
    name: '百分数',
    icon: '⬜',
    color: 'slate',
    levels: PC_LEVELS,
    prerequisites: ['DE-2', 'FR-2'],
  },
  {
    id: 'NG',
    name: '负数',
    icon: '⬛',
    color: 'zinc',
    levels: NG_LEVELS,
    prerequisites: ['MX-3'],
  },
  {
    id: 'PW',
    name: '幂与根',
    icon: '🔷',
    color: 'indigo',
    levels: PW_LEVELS,
    prerequisites: ['MU-7', 'NG-2'],
  },
  {
    id: 'AP',
    name: '综合应用',
    icon: '🏆',
    color: 'yellow',
    levels: AP_LEVELS,
    prerequisites: ['MX-3', 'DE-1', 'FR-1'],
  },
]

// ─── 查询工具函数 ─────────────────────────────────────────────────────

const _treeMap = new Map(SKILL_TREES.map((t) => [t.id, t]))
const _levelMap = new Map(SKILL_TREES.flatMap((t) => t.levels.map((l) => [l.id, l])))

export function getTree(id: TreeId): TreeConfig | undefined {
  return _treeMap.get(id)
}

export function getLevel(id: LevelId): LevelConfig | undefined {
  return _levelMap.get(id)
}

export function getTreeForLevel(levelId: LevelId): TreeConfig | undefined {
  const treeId = levelId.split('-')[0] as TreeId
  return _treeMap.get(treeId)
}

export function getAllLevelIds(): LevelId[] {
  return SKILL_TREES.flatMap((t) => t.levels.map((l) => l.id))
}

/** 计算给定关卡是否已解锁：树前置 + 同树内前一关都通过 */
export function isLevelUnlocked(
  levelId: LevelId,
  passedLevels: Set<LevelId>,
): boolean {
  const tree = getTreeForLevel(levelId)
  const level = getLevel(levelId)
  if (!tree || !level) return false

  // 树的前置条件（其他树的某个关卡三档全通）
  for (const prereq of tree.prerequisites) {
    if (!passedLevels.has(prereq)) return false
  }

  // 同树内前一关
  if (level.prevLevel && !passedLevels.has(level.prevLevel)) return false

  return true
}

/** 初始解锁列表：所有没有前置条件的关卡 */
export function getInitialUnlockedLevels(): LevelId[] {
  const empty = new Set<LevelId>()
  return getAllLevelIds().filter((id) => isLevelUnlocked(id, empty))
}
