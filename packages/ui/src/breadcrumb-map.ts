/**
 * 面包屑路由映射表：pathname → 页面标签。
 *
 * 维护约定：新增页面路由时，必须检查此表并补充条目及上级链，
 * 否则该页面会兜底显示「返回首页」按钮，丢失逐级回退能力。
 */

export interface BreadcrumbRoute {
  /** pathname 段数组；动态段写作 [name]，匹配任意值 */
  pattern: string[]
  /** 页面标签，可用 {name} 引用动态段值，如 'Unit {unitId}' */
  label: string
  /** 动态段取值映射（如 book id → 中文书名）；未命中时用原始段值 */
  labelMap?: Record<string, Record<string, string>>
}

export const BREADCRUMB_ROUTES: BreadcrumbRoute[] = [
  { pattern: ['chinese'], label: '语文' },
  {
    pattern: ['chinese', '[bookSlug]'],
    label: '{bookSlug}',
    labelMap: {
      bookSlug: {
        g1b: '一年级下册',
        g2a: '二年级上册',
        g2b: '二年级下册',
      },
    },
  },
  { pattern: ['chinese', '[bookSlug]', 'chars'], label: '生字库' },
  { pattern: ['chinese', '[bookSlug]', 'daily'], label: '今日' },
  { pattern: ['chinese', '[bookSlug]', 'reading'], label: '阅读' },
  { pattern: ['chinese', '[bookSlug]', 'reading', '[lessonKey]'], label: '课文' },
  { pattern: ['chinese', '[bookSlug]', 'poems'], label: '古诗' },
  { pattern: ['chinese', '[bookSlug]', 'accumulation'], label: '日积月累' },
  { pattern: ['chinese', '[bookSlug]', 'recordings'], label: '朗读记录' },
  { pattern: ['chinese', '[bookSlug]', 'units', '[unit]'], label: '第 {unit} 单元' },
  { pattern: ['chinese', '[bookSlug]', 'wrong'], label: '错题本' },
  { pattern: ['chinese', 'chars'], label: '生字库' },
  { pattern: ['chinese', 'daily'], label: '今日' },
  { pattern: ['chinese', 'reading'], label: '阅读' },
  { pattern: ['chinese', 'reading', '[lessonKey]'], label: '课文' },
  { pattern: ['chinese', 'poems'], label: '古诗' },
  { pattern: ['chinese', 'poems', '[id]'], label: '古诗背诵' },
  { pattern: ['chinese', 'accumulation'], label: '日积月累' },
  { pattern: ['chinese', 'units', '[unit]'], label: '第 {unit} 单元' },
  { pattern: ['chinese', 'weekly'], label: '周计划' },
  { pattern: ['chinese', 'wrong'], label: '错题本' },
  { pattern: ['chinese', 'garden'], label: '识字加油站' },
  { pattern: ['english'], label: '英语' },
  { pattern: ['english', 'words', 'reading'], label: '阅读' },
  { pattern: ['english', 'words', 'reading', 'story'], label: 'Story' },
  { pattern: ['english', 'words', 'reading', 'story', '[seriesSlug]'], label: '{seriesSlug}', labelMap: { seriesSlug: { 'magic-tree-house': 'Magic Tree House' } } },
  { pattern: ['english', 'words', 'reading', 'story', '[seriesSlug]', '[volumeSlug]'], label: '{volumeSlug}', labelMap: { volumeSlug: { 'dinosaurs-before-dark': 'Dinosaurs Before Dark' } } },
  { pattern: ['english', 'words', 'reading', 'story', '[seriesSlug]', '[volumeSlug]', 'full'], label: '整辑阅读' },
  { pattern: ['english', 'words', 'reading', 'story', '[seriesSlug]', '[volumeSlug]', '[chapterKey]'], label: '章节' },
  { pattern: ['english', 'grammar'], label: '语法' },
  {
    pattern: ['english', 'grammar', '[book]'],
    label: '{book}',
    labelMap: {
      book: {
        essential: '剑桥初级英语语法',
        intermediate: '剑桥中级英语语法',
        advanced: '剑桥高级英语语法',
      },
    },
  },
  { pattern: ['english', 'grammar', '[book]', 'study-guide'], label: '学习指导' },
  { pattern: ['english', 'grammar', '[book]', '[unitId]'], label: 'Unit {unitId}' },
  { pattern: ['math'], label: '数学' },
  { pattern: ['math', 'catalog'], label: '目录' },
  { pattern: ['math', 'favorites'], label: '收藏' },
  { pattern: ['math', 'ny', '[grade]'], label: '{grade}年级' },
  { pattern: ['math', 'ny', '[grade]', '[seq]'], label: '第 {seq} 讲' },
  { pattern: ['math', 'ny', '[grade]', '[seq]', 'notes'], label: '笔记' },
  { pattern: ['mistakes'], label: '错题本' },
  { pattern: ['today'], label: '今日计划' },
  { pattern: ['today', 'calendar'], label: '计划日历' },
  { pattern: ['today', 'records'], label: '练习记录' },
  { pattern: ['today', 'report'], label: '练习报告' },
  { pattern: ['vouchers'], label: '兑换券' },
  { pattern: ['setting'], label: '设置' },
  { pattern: ['admin'], label: '管理' },
  { pattern: ['admin', 'audio'], label: '音频管理' },
  { pattern: ['admin', 'word-audit'], label: '词库审计' },
]

export interface BreadcrumbItem {
  label: string
  href: string
}

function isDynamic(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']')
}

function findRoute(segments: string[]): BreadcrumbRoute | undefined {
  const matches = BREADCRUMB_ROUTES.filter(
    (route) =>
      route.pattern.length === segments.length &&
      route.pattern.every((part, i) => isDynamic(part) || part === segments[i]),
  )
  if (matches.length === 0) return undefined
  // 静态段多的条目优先，避免命中依赖数组书写顺序（如 study-guide vs [unitId]）
  const dynamicCount = (r: BreadcrumbRoute) => r.pattern.filter(isDynamic).length
  return matches.reduce((best, route) => (dynamicCount(route) < dynamicCount(best) ? route : best))
}

function fillLabel(route: BreadcrumbRoute, segments: string[]): string {
  let label = route.label
  route.pattern.forEach((part, i) => {
    if (!isDynamic(part)) return
    const name = part.slice(1, -1)
    const raw = segments[i]
    const value = route.labelMap?.[name]?.[raw] ?? raw
    label = label.replaceAll(`{${name}}`, value)
  })
  return label
}

/**
 * 由 pathname 计算面包屑链（不含首页；首页由组件固定前置）。
 * 末项为当前页。无匹配路由时返回 null（组件兜底渲染返回按钮）。
 */
export function buildBreadcrumb(pathname: string): BreadcrumbItem[] | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const segments = normalized.split('/').filter(Boolean)
  const current = findRoute(segments)
  if (!current) return null

  const items: BreadcrumbItem[] = []
  for (let depth = 1; depth < segments.length; depth++) {
    const ancestor = segments.slice(0, depth)
    const route = findRoute(ancestor)
    // 无映射的中间层直接跳过（如 math/ny）
    if (!route) continue
    items.push({ label: fillLabel(route, ancestor), href: `/${ancestor.join('/')}` })
  }
  items.push({ label: fillLabel(current, segments), href: normalized })
  return items
}
