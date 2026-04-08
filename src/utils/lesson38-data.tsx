import type { Problem, ProblemSet } from './type'
import CubeFigure from '@/components/math/lesson38/Figure/CubeFigure'
import RectBoxFigure from '@/components/math/lesson38/Figure/RectBoxFigure'
import MuseumFigure from '@/components/math/lesson38/Figure/MuseumFigure'
import ExhibitFigure from '@/components/math/lesson38/Figure/ExhibitFigure'
import StreetMapFigure from '@/components/math/lesson38/Figure/StreetMapFigure'

const SUPPLEMENT: Problem[] = [
  {
    id: '38-S1',
    title: '附加1 · 正方体棱爬行',
    tag: 'type1',
    tagLabel: '立体棱爬行',
    text: '一只蚂蚁沿正方体的棱爬行，经过所有的顶点，且它没有重复走任何一条棱，最后回到出发点。那么它<strong>至少有几条棱没有经过</strong>？',
    analysis: [
      '正方体有 12 条棱，8 个顶点，每个顶点连接 3 条棱（奇点）',
      '蚂蚁要经过所有 8 个顶点，不重复走棱，最后回到出发点',
      '这是"哈密顿回路"：经过每个顶点恰好一次并回到起点',
      '正方体存在哈密顿回路（例如顶部4顶点依次→底部4顶点依次绕一圈）',
      '哈密顿回路经过 8 个顶点，共使用 8 条棱',
      '至少未经过的棱数 = 12 − 8 = 4 条',
    ],
    type: 'none',
    finalQ: '至少有几条棱没有经过？',
    finalUnit: '条',
    finalAns: 4,
    figureNode: <CubeFigure />,
  },
  {
    id: '38-S2',
    title: '附加2 · 长方体棱爬行',
    tag: 'type1',
    tagLabel: '立体棱爬行',
    text: '一条小虫从 A 点出发，沿长 <strong>6 厘米</strong>、宽 <strong>4 厘米</strong>、高 <strong>5 厘米</strong>的长方体的棱爬行，它没有重复走任何一条棱，那么它<strong>最多能爬多少厘米</strong>？',
    analysis: [
      '长方体各棱：长 6cm×4条，宽 4cm×4条，高 5cm×4条',
      '总棱长 = 4×6 + 4×4 + 4×5 = 24 + 16 + 20 = 60 cm',
      '长方体 8 个顶点，每个顶点连 3 条棱（全是奇点），共 8 个奇点',
      '8 个奇点 → 不能不重复地走完所有棱（需要 0 或 2 个奇点）',
      '有 8 个奇点，需"配对"其中 6 个（保留起点 A 和某终点各一个奇点）',
      '3 次配对，每次跳过一条棱。为使总路程最长，跳过最短的 3 条棱（4cm）',
      '最多爬：60 − 3×4 = 60 − 12 = 48 cm',
    ],
    type: 'none',
    finalQ: '最多能爬多少厘米？',
    finalUnit: 'cm',
    finalAns: 48,
    figureNode: <RectBoxFigure />,
  },
  {
    id: '38-S3',
    title: '附加3 · 博物馆参观路线',
    tag: 'type2',
    tagLabel: '平面路线',
    text: '下图是一座博物馆的示意图，游客从<strong>入口</strong>进入博物馆。是否能找到一条参观路线，<strong>穿过所有的门并且每扇门恰好经过一次</strong>？',
    analysis: [
      '把每个房间（区域）和室外看作"点"，每扇门看作连接两点的"线"',
      '一笔画条件：奇点数 = 0（能回到起点）或 2（能从一奇点到另一奇点）',
      '统计每个区域（包括室外）被多少扇门连接，判断奇偶性',
      '逐一检查博物馆各区域：发现有 4 个区域的门数为奇数（奇点）',
      '奇点数 = 4 > 2，不满足一笔画条件',
      '❌ 结论：不能找到穿过所有门恰好一次的参观路线',
    ],
    type: 'none',
    finalQ: '能否找到这样的路线？（能=1，不能=0）',
    finalUnit: '',
    finalAns: 0,
    figureNode: <MuseumFigure />,
  },
  {
    id: '38-S4',
    title: '附加4 · 展览厅参观路线',
    tag: 'type2',
    tagLabel: '平面路线',
    text: '下图是某展厅的平面图，由 <strong>5 个展室</strong>组成，任意两展室之间都有门相通，整个展览厅还有一个<strong>进口</strong>和一个<strong>出口</strong>。游客能否一次不重复地穿过所有的门，并且从入口进、从出口出？',
    analysis: [
      '5 个展室两两相通 → C(5,2) = 10 扇内部门，每个展室连 4 扇内门（偶数）',
      '室外区域：连接进口+出口，共 2 扇门 → 偶点',
      '进口所在展室 A：4 扇内门 + 1 扇进口 = 5 扇门 → 奇点',
      '出口所在展室 B：4 扇内门 + 1 扇出口 = 5 扇门 → 奇点',
      '其余 3 个展室：各 4 扇门 → 偶点',
      '共 2 个奇点（展室A和展室B），满足一笔画条件！',
      '✅ 能！从进口进入展室 A（奇点）→ 穿过所有门 → 从展室 B（奇点）的出口离开',
    ],
    type: 'none',
    finalQ: '能否完成参观？（能=1，不能=0）',
    finalUnit: '',
    finalAns: 1,
    figureNode: <ExhibitFigure />,
  },
  {
    id: '38-S5',
    title: '附加5 · 动物园街道最短路程',
    tag: 'type3',
    tagLabel: '最短路程',
    text: '老师带同学们乘观光车游览野生动物园，大巴车从<strong>起点</strong>出发，走遍每一条街道最后回到起点。街道宽（千米）从左到右为 3、4、2、1、4，高度为 5 千米。<strong>大巴车所走的最短路程是多少千米</strong>？',
    analysis: [
      '街道总长：底边 3+4+2+1+4=14 km，顶边 14 km，纵向 6 条各 5 km = 30 km',
      '总街道长 = 14 + 14 + 30 = 58 km',
      '路口度数：4个底部内部路口和4个顶部内部路口各连 3 条路 → 共 8 个奇点',
      '要走遍所有街道并回到起点（欧拉回路），需让所有奇点变成偶点',
      '8 个奇点需配成 4 对，每对重复走一段路（中国邮递员问题）',
      '最优配对：底部（路口1-2配对重复4km，路口3-4配对重复1km）= 5km',
      '顶部同理：（路口1-2配对重复4km，路口3-4配对重复1km）= 5km',
      '总额外路程 = 5 + 5 = 10 km',
      '最短路程 = 58 + 10 = 68 km',
    ],
    type: 'none',
    finalQ: '大巴车所走的最短路程是多少千米？',
    finalUnit: 'km',
    finalAns: 68,
    figureNode: <StreetMapFigure />,
  },
]

export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: [],
  homework: [],
  workbook: [],
  supplement: SUPPLEMENT,
}

export const PROBLEM_TYPES = [
  {
    tag: 'type1',
    color: 'orange',
    label: '题型1 · 立体棱爬行',
    desc: '在正方体/长方体棱上爬行，求哈密顿路径或最长无重复路径。',
    example: '例：蚂蚁绕正方体爬过所有顶点',
  },
  {
    tag: 'type2',
    color: 'purple',
    label: '题型2 · 平面路线',
    desc: '博物馆/展厅楼层图，判断能否穿过所有门恰好一次（欧拉路径）。',
    example: '例：展厅5展室，从入口到出口穿所有门',
  },
  {
    tag: 'type3',
    color: 'green',
    label: '题型3 · 街道最短路',
    desc: '在路网中从起点出发走遍所有街道回到起点，求最短路程（中国邮递员问题）。',
    example: '例：动物园 3×4×2×1×4 / 5 km 路网',
  },
]

export const TYPE_STYLE: Record<
  string,
  { bg: string; border: string; titleColor: string; textColor: string }
> = {
  type1: {
    bg: 'bg-orange-50',
    border: 'border-l-orange-500',
    titleColor: 'text-orange-800',
    textColor: 'text-orange-900',
  },
  type2: {
    bg: 'bg-purple-50',
    border: 'border-l-purple-500',
    titleColor: 'text-purple-800',
    textColor: 'text-purple-900',
  },
  type3: {
    bg: 'bg-green-50',
    border: 'border-l-green-500',
    titleColor: 'text-green-800',
    textColor: 'text-green-900',
  },
}

export const TAG_STYLE: Record<string, string> = {
  type1: 'bg-orange-100 text-orange-800',
  type2: 'bg-purple-100 text-purple-800',
  type3: 'bg-green-100 text-green-800',
}
