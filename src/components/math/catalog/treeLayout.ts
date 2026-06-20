// XMind 风格思维导图布局：中心 → 题型 → 书 → 讲次 → 难度
import {
  BOOKS,
  bookOrder,
  isCross,
  type Lesson,
  SERIES_COLOR,
  stars,
  tcolor,
} from '@/utils/catalog-data'

export type NodeKind = 'root' | 'topic' | 'book' | 'lesson'

export interface MapNode {
  id: string
  label: string
  kind: NodeKind
  color: string
  diff?: number
  children: MapNode[]
  // layout (filled by layoutMap)
  x: number
  w: number
  h: number
  cy: number
}

export interface PositionedNode {
  id: string
  label: string
  kind: NodeKind
  color: string
  diff?: number
  x: number
  y: number
  w: number
  h: number
  cy: number
  hasChild: boolean
  expanded: boolean
}

export interface Edge {
  d: string
  color: string
}

export interface LayoutResult {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: Edge[]
  topicCount: number
}

const NODEH = 30
const LESSONH = 46
const VGAP = 9
const HGAP = 46

/** 由筛选后的讲次构建题型→书→讲次树 */
export function buildMapData(lessons: Lesson[], selectedTopics: Set<string>): MapNode {
  const T: Record<string, Record<string, Lesson[]>> = {}
  lessons.forEach((l) =>
    l.tags.forEach((t) => {
      if (selectedTopics.size && !selectedTopics.has(t)) return
      T[t] = T[t] || {}
      ;(T[t][l.book] = T[t][l.book] || []).push(l)
    }),
  )
  const topics = Object.keys(T)
  const tMax = (t: string) => Math.max(...Object.values(T[t]).flat().map((l) => l.diff))
  topics.sort(
    (a, b) =>
      tMax(b) - tMax(a) ||
      Object.keys(T[b]).length - Object.keys(T[a]).length ||
      a.localeCompare(b, 'zh'),
  )
  const root: MapNode = {
    id: 'root',
    label: `数学思维题型（${topics.length}）`,
    kind: 'root',
    color: '#2b2d42',
    children: [],
    x: 0,
    w: 0,
    h: 0,
    cy: 0,
  }
  topics.forEach((t) => {
    const tid = 't:' + t
    const bks = Object.keys(T[t])
    const tNode: MapNode = {
      id: tid,
      label: t + (isCross(t) ? '' : ' ·单本'),
      kind: 'topic',
      color: tcolor(t),
      children: [],
      x: 0,
      w: 0,
      h: 0,
      cy: 0,
    }
    const bMax = (b: string) => Math.max(...T[t][b].map((l) => l.diff))
    bks.sort((a, b) => bMax(b) - bMax(a) || bookOrder(a) - bookOrder(b))
    bks.forEach((bk) => {
      const bid = tid + '>b:' + bk
      const bNode: MapNode = {
        id: bid,
        label: BOOKS[bk].full,
        kind: 'book',
        color: SERIES_COLOR[BOOKS[bk].series],
        children: [],
        x: 0,
        w: 0,
        h: 0,
        cy: 0,
      }
      T[t][bk]
        .slice()
        .sort((x, y) => y.diff - x.diff || x.no - y.no)
        .forEach((l) => {
          bNode.children.push({
            id: bid + '>l:' + l.no,
            label: `第${l.no}讲 ${l.title}`,
            kind: 'lesson',
            color: tcolor(t),
            diff: l.diff,
            children: [],
            x: 0,
            w: 0,
            h: 0,
            cy: 0,
          })
        })
      tNode.children.push(bNode)
    })
    root.children.push(tNode)
  })
  return root
}

function measure(t: string): number {
  let len = 0
  // 单字节字符（ASCII/Latin-1）按 8px，全角字符按 15px 估算宽度
  for (const ch of t) len += ch.charCodeAt(0) < 256 ? 8 : 15
  return len
}
function nodeW(n: MapNode): number {
  let w = measure(n.label) + 26
  if (n.kind === 'lesson' && n.diff !== undefined) {
    w = Math.max(w, measure(stars(n.diff) + '  ' + n.diff + '/5') + 26)
  }
  return Math.min(300, Math.max(72, w))
}

/** 计算布局并返回扁平节点与连线 */
export function layoutMap(root: MapNode, expanded: Set<string>): LayoutResult {
  const isExpanded = (n: MapNode) => n.id === 'root' || expanded.has(n.id)
  const visChildren = (n: MapNode) =>
    n.children.length && isExpanded(n) ? n.children : []

  let cursor = 14
  const assignY = (n: MapNode) => {
    n.w = nodeW(n)
    n.h = n.kind === 'lesson' ? LESSONH : NODEH
    const ch = visChildren(n)
    if (!ch.length) {
      n.cy = cursor + n.h / 2
      cursor += n.h + VGAP
    } else {
      ch.forEach(assignY)
      n.cy = (ch[0].cy + ch[ch.length - 1].cy) / 2
    }
  }
  assignY(root)
  const assignX = (n: MapNode, x: number) => {
    n.x = x
    visChildren(n).forEach((c) => assignX(c, x + n.w + HGAP))
  }
  assignX(root, 14)

  let maxX = 0
  let maxY = 0
  const nodes: PositionedNode[] = []
  const edges: Edge[] = []
  const walk = (n: MapNode) => {
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.cy + n.h / 2)
    const ch = visChildren(n)
    ch.forEach((c) => {
      const px = n.x + n.w
      const py = n.cy
      const cx = c.x
      const cy = c.cy
      const dx = Math.max(16, (cx - px) / 2)
      edges.push({
        d: `M${px},${py} C${px + dx},${py} ${cx - dx},${cy} ${cx},${cy}`,
        color: c.color || '#c0c7d6',
      })
      walk(c)
    })
    nodes.push({
      id: n.id,
      label: n.label,
      kind: n.kind,
      color: n.color,
      diff: n.diff,
      x: n.x,
      y: n.cy - n.h / 2,
      w: n.w,
      h: n.h,
      cy: n.cy,
      hasChild: n.children.length > 0,
      expanded: isExpanded(n),
    })
  }
  walk(root)

  return {
    width: maxX + 30,
    height: Math.max(maxY + 16, cursor + 10),
    nodes,
    edges,
    topicCount: root.children.length,
  }
}

/** 收集满足条件、且有子节点的节点 id（用于「展开到书 / 全部展开」） */
export function collectIds(root: MapNode, pred: (n: MapNode) => boolean): string[] {
  const out: string[] = []
  const w = (n: MapNode) => {
    if (n.id !== 'root' && n.children.length && pred(n)) out.push(n.id)
    n.children.forEach(w)
  }
  w(root)
  return out
}
