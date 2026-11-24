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
  { pattern: ['chinese', '[bookSlug]', 'poems', '[id]'], label: '古诗背诵' },
  { pattern: ['setting', 'task-entries'], label: '作业内容管理' },
  { pattern: ['demos'], label: 'Demo 总入口' },
  { pattern: ['dev-preview', 'exams'], label: '考一考答题预览' },
  { pattern: ['dev-preview', 'homework-content'], label: '作业内容预览' },
  { pattern: ['superpowers'], label: '我的超能力' },
  { pattern: ['exams', 'ket'], label: '考一考 · KET' },
  { pattern: ['exams', 'ket', 'practice'], label: '专项练习' },
  { pattern: ['exams', 'attempts'], label: '考一考记录' },
  { pattern: ['exams', 'attempts', '[id]'], label: '考试作答' },
  { pattern: ['exams', 'attempts', '[id]', 'review'], label: '作答复盘' },
  { pattern: ['exams', 'reports'], label: '学习报告' },
  { pattern: ['exams', 'review-words'], label: '词汇补练' },
  { pattern: ['exams', 'review-words', '[batchId]'], label: '本次词汇补练' },
  { pattern: ['time-tree'], label: '生命树' },
  { pattern: ['setting', 'time-tree'], label: '生命树设置' },
  { pattern: ['tasks'], label: '课程安排' },
  { pattern: ['tasks', 'timetable'], label: '课程表' },
  { pattern: ['tasks', 'homework'], label: '作业管理' },
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
  { pattern: ['english', 'theater'], label: '电影剧场' },
  { pattern: ['english', 'theater', '[filmId]'], label: '影片播放' },
  { pattern: ['english', 'library'], label: '词库' },
  { pattern: ['english', 'words'], label: '单词' },
  { pattern: ['english', 'words', 'practice'], label: '单词练习' },
  { pattern: ['english', 'words', 'practice', 'pet'], label: 'PET 日常与专项' },
  { pattern: ['english', 'words', 'reading'], label: '阅读' },
  { pattern: ['stories'], label: '故事屋' },
  {
    pattern: ['stories', '[seriesSlug]'],
    label: '{seriesSlug}',
    labelMap: {
      seriesSlug: {
        'magic-tree-house': 'Magic Tree House',
        'roald-dahl': 'Roald Dahl Collection',
        'dragon-masters': 'Dragon Masters',
        warriors: 'Warriors',
        'warriors-the-prophecies-begin': 'Warriors: The Prophecies Begin',
        'warriors-the-new-prophecy': 'Warriors: The New Prophecy',
        'warriors-power-of-three': 'Warriors: Power of Three',
        'warriors-omen-of-the-stars': 'Warriors: Omen of the Stars',
        'warriors-dawn-of-the-clans': 'Warriors: Dawn of the Clans',
        'warriors-a-vision-of-shadows': 'Warriors: A Vision of Shadows',
        'warriors-the-broken-code': 'Warriors: The Broken Code',
        'warriors-a-starless-clan': 'Warriors: A Starless Clan',
      },
    },
  },
  {
    pattern: ['stories', '[seriesSlug]', '[volumeSlug]'],
    label: '{volumeSlug}',
    labelMap: {
      volumeSlug: {
        'charlie-and-the-chocolate-factory': 'Charlie and the Chocolate Factory',
        'charlie-and-the-great-glass-elevator': 'Charlie and the Great Glass Elevator',
        'danny-the-champion-of-the-world': 'Danny the Champion of the World',
        'fantastic-mr-fox': 'Fantastic Mr Fox',
        'georges-marvellous-medicine': 'George’s Marvellous Medicine',
        'james-and-the-giant-peach': 'James and the Giant Peach',
        matilda: 'Matilda',
        'revolting-rhymes': 'Revolting Rhymes',
        'the-magic-finger': 'The Magic Finger',
        'the-twits': 'The Twits',
        'the-witches': 'The Witches',
        'dinosaurs-before-dark': 'Dinosaurs Before Dark',
        'bloom-of-the-flower-dragon': 'Bloom of the Flower Dragon',
        'call-of-the-sound-dragon': 'Call of the Sound Dragon',
        'chill-of-the-ice-dragon': 'Chill of the Ice Dragon',
        'curse-of-the-shadow-dragon': 'Curse of the Shadow Dragon',
        'dawn-of-the-light-dragon': 'Dawn of the Light Dragon',
        'eye-of-the-earthquake-dragon': 'Eye of the Earthquake Dragon',
        'flight-of-the-moon-dragon': 'Flight of the Moon Dragon',
        'fortress-of-the-stone-dragon': 'Fortress of the Stone Dragon',
        'future-of-the-time-dragon': 'Future of the Time Dragon',
        'griffiths-guide-for-dragon-masters': 'Griffith’s Guide for Dragon Masters',
        'guarding-the-invisible-dragons': 'Guarding the Invisible Dragons',
        'heat-of-the-lava-dragon': 'Heat of the Lava Dragon',
        'howl-of-the-wind-dragon': 'Howl of the Wind Dragon',
        'power-of-the-fire-dragon': 'Power of the Fire Dragon',
        'roar-of-the-thunder-dragon': 'Roar of the Thunder Dragon',
        'search-for-the-lightning-dragon': 'Search for the Lightning Dragon',
        'secret-of-the-water-dragon': 'Secret of the Water Dragon',
        'shine-of-the-silver-dragon': 'Shine of the Silver Dragon',
        'song-of-the-poison-dragon': 'Song of the Poison Dragon',
        'the-land-of-the-spring-dragon': 'The Land of the Spring Dragon',
        'treasure-of-the-gold-dragon': 'Treasure of the Gold Dragon',
        'waking-the-rainbow-dragon': 'Waking the Rainbow Dragon',
        'wave-of-the-sea-dragon': 'Wave of the Sea Dragon',
        'rise-of-the-earth-dragon': 'Rise of the Earth Dragon',
        'saving-the-sun-dragon': 'Saving the Sun Dragon',
        'the-knight-at-dawn': 'The Knight at Dawn',
        'into-the-wild': 'Into the Wild',
        'fire-and-ice': 'Fire and Ice',
        'forest-of-secrets': 'Forest of Secrets',
        'rising-storm': 'Rising Storm',
        'a-dangerous-path': 'A Dangerous Path',
        'the-darkest-hour': 'The Darkest Hour',
        'midnight': 'Midnight',
        'moonrise': 'Moonrise',
        'dawn': 'Dawn',
        'starlight': 'Starlight',
        'twilight': 'Twilight',
        'sunset': 'Sunset',
        'the-sight': 'The Sight',
        'dark-river': 'Dark River',
        'outcast': 'Outcast',
        'eclipse': 'Eclipse',
        'long-shadows': 'Long Shadows',
        'sunrise': 'Sunrise',
        'the-fourth-apprentice': 'The Fourth Apprentice',
        'fading-echoes': 'Fading Echoes',
        'night-whispers': 'Night Whispers',
        'sign-of-the-moon': 'Sign of the Moon',
        'the-forgotten-warrior': 'The Forgotten Warrior',
        'the-last-hope': 'The Last Hope',
        'the-sun-trail': 'The Sun Trail',
        'thunder-rising': 'Thunder Rising',
        'the-first-battle': 'The First Battle',
        'the-blazing-star': 'The Blazing Star',
        'a-forest-divided': 'A Forest Divided',
        'path-of-stars': 'Path of Stars',
        'the-apprentices-quest': 'The Apprentice’s Quest',
        'thunder-and-shadow': 'Thunder and Shadow',
        'shattered-sky': 'Shattered Sky',
        'darkest-night': 'Darkest Night',
        'river-of-fire': 'River of Fire',
        'the-raging-storm': 'The Raging Storm',
        'lost-stars': 'Lost Stars',
        'the-silent-thaw': 'The Silent Thaw',
        'veil-of-shadows': 'Veil of Shadows',
        'darkness-within': 'Darkness Within',
        'the-place-of-no-stars': 'The Place of No Stars',
        'a-light-in-the-mist': 'A Light in the Mist',
        'river': 'River',
        'sky': 'Sky',
        'shadow': 'Shadow',
        'thunder': 'Thunder',
        'wind': 'Wind',
        'star': 'Star',
      },
    },
  },
  {
    pattern: ['stories', '[seriesSlug]', '[volumeSlug]', 'full'],
    label: '整辑阅读',
  },
  {
    pattern: [
      'stories',
      '[seriesSlug]',
      '[volumeSlug]',
      '[chapterKey]',
    ],
    label: '章节',
  },
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
  { pattern: ['draw'], label: '抽一抽' },
  { pattern: ['setting', 'draw-pools'], label: '奖惩管理' },
  { pattern: ['setting'], label: '设置' },
  { pattern: ['setting', 'calc'], label: '口算策略' },
  { pattern: ['setting', 'calc', 'new'], label: '新增策略' },
  { pattern: ['setting', 'calc', '[strategyId]'], label: '编辑策略' },
  { pattern: ['admin'], label: '管理' },
  { pattern: ['admin', 'exams'], label: '考试管理' },
  { pattern: ['admin', 'exams', 'attempts'], label: '用户作答与批改' },
  { pattern: ['admin', 'exams', 'images'], label: '图片任务' },
  { pattern: ['admin', 'exams', '[id]'], label: '内容编辑与审核' },
  { pattern: ['admin', 'sync'], label: '同步管理' },
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
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
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
