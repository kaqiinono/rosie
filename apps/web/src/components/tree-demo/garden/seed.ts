// 原型用的假数据：按 Rosie 真实的作业名称和时长摆好一周，只在浏览器内存里使用。

import {
  DEFAULT_K,
  DEFAULT_N,
  addDaysKey,
  collapseHistory,
  toKey,
  uid,
  type Apple,
  type Bud,
  type Flower,
  type GardenState,
  type SubjectKey,
} from './model'

type BudSpec = [name: string, subject: SubjectKey, minutes: number]

// 下标是距离今天的天数，0 是今天。
const PLAN: BudSpec[][] = [
  [
    ['单课预习', 'chinese', 15],
    ['看拼音写字', 'chinese', 10],
    ['每日三道题', 'math', 20],
    ['每日单词', 'english', 15],
    ['背三句话', 'english', 15],
  ],
  [
    ['单课复习', 'chinese', 15],
    ['每日三道题', 'math', 30],
    ['每日单词', 'english', 15],
    ['默写三句话', 'english', 15],
  ],
  [
    ['日积月累背诵', 'chinese', 15],
    ['课堂内容巩固', 'math', 60],
    ['每日单词', 'english', 15],
    ['看图写话', 'chinese', 5],
  ],
  [
    ['单元复习', 'chinese', 30],
    ['Workbook 练习', 'english', 30],
    ['每日三道题', 'math', 30],
    ['阅读', 'life', 20],
  ],
  [
    ['单课预习', 'chinese', 15],
    ['写一篇作文', 'english', 30],
    ['每日单词', 'english', 15],
  ],
  [
    ['每日单词', 'english', 15],
    ['看图写话', 'chinese', 5],
    ['运动', 'life', 30],
  ],
  [
    ['背三句话', 'english', 15],
    ['单课复习', 'chinese', 15],
  ],
]

const PARKED: BudSpec[] = [
  ['日积月累默写', 'chinese', 5],
  ['早睡', 'life', 5],
]

function bud(spec: BudSpec, dateKey: string | null, overdue = false): Bud {
  const [name, subject, minutes] = spec
  return { id: uid('b'), name, subject, minutes, dateKey, overdue }
}

export function createSeed(now: Date = new Date()): GardenState {
  const today = toKey(now)
  const yesterday = addDaysKey(today, -1)

  const buds: Bud[] = []
  PLAN.forEach((day, offset) => {
    for (const spec of day) buds.push(bud(spec, addDaysKey(today, offset)))
  })
  for (const spec of PARKED) buds.push(bud(spec, null))
  // 历史叶区里的灰色花苞
  buds.push(bud(['看图写话', 'chinese', 5], yesterday, true))
  buds.push(bud(['默写三句话', 'english', 15], addDaysKey(today, -3), true))

  const flower = (subject: SubjectKey, name: string, stage: number): Flower => ({
    id: uid('f'),
    subject,
    name,
    dateKey: today,
    stage,
    makeup: false,
  })
  const flowers: Flower[] = [
    flower('chinese', '单课预习', 1),
    flower('english', '背三句话', 2),
    flower('english', '背三句话', 0),
    flower('math', '每日三道题', 3),
  ]

  const apple = (kind: Apple['kind'], dateKey: string, from?: Apple['from']): Apple => ({
    id: uid('a'),
    kind,
    dateKey,
    from,
  })
  const apples: Apple[] = [
    apple('chinese', yesterday),
    apple('english', yesterday),
    apple('math', addDaysKey(today, -2)),
    apple('rainbow', addDaysKey(today, -2), 'math'),
  ]

  const state: GardenState = {
    today,
    buds,
    flowers,
    apples,
    stones: { chinese: 5, math: 3, english: 6, life: 1 },
    stoneTotal: 15,
    remainder: { chinese: 1, math: 0, english: 1 },
    pity: 7,
    rings: 3,
    aliveHistory: [],
    sun: 8,
    water: 4,
    streak: 2,
    lastPopDay: yesterday,
    afterSchool: false,
    bubbles: [],
    bubbleSlots: {},
    popsToday: 0,
    goalGiven: false,
    lastPopAt: 0,
    combo: 0,
    exchanges: 0,
    totalPops: 6,
    settings: { k: DEFAULT_K, n: DEFAULT_N },
    diary: [
      { id: uid('d'), t: now.getTime() - 3600_000 * 20, icon: '🍎', text: '摘下了 1 个红苹果，落下一颗红玛瑙' },
      { id: uid('d'), t: now.getTime() - 3600_000 * 21, icon: '🫧', text: '戳破了「每日单词」泡泡' },
    ],
  }
  return collapseHistory(state)
}
