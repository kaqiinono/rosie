'use client'

import { useMemo, useState } from 'react'
import { type Lesson, stars } from '@/utils/catalog-data'
import { buildMapData, collectIds, layoutMap, type PositionedNode } from './treeLayout'

type CatalogTreeProps = {
  lessons: Lesson[]
  selectedTopics: Set<string>
}

function NodeShape({ n, onToggle }: { n: PositionedNode; onToggle: (id: string) => void }) {
  const r = n.kind === 'lesson' ? 12 : n.h / 2
  let fill: string
  let stroke: string
  let tcol: string
  let fw: string
  if (n.kind === 'root') {
    fill = '#2b2d42'
    stroke = '#2b2d42'
    tcol = '#fff'
    fw = '700'
  } else if (n.kind === 'topic') {
    fill = n.color
    stroke = n.color
    tcol = '#fff'
    fw = '700'
  } else if (n.kind === 'book') {
    fill = n.color
    stroke = n.color
    tcol = '#fff'
    fw = '600'
  } else {
    fill = '#fff'
    stroke = n.color
    tcol = '#1f2733'
    fw = '500'
  }

  return (
    <g
      style={{ cursor: n.hasChild ? 'pointer' : 'default' }}
      onClick={() => n.hasChild && onToggle(n.id)}
    >
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={r}
        ry={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
      {n.kind === 'lesson' && n.diff !== undefined ? (
        <>
          <text x={n.x + 13} y={n.cy - 3} fontSize={13} fontWeight={500} fill="#1f2733">
            {n.label}
          </text>
          <text x={n.x + 13} y={n.cy + 15} fontSize={12.5} letterSpacing={1} fill="#f5a623">
            {stars(n.diff)}{' '}
            <tspan fill="#9aa3b2" fontSize={11} letterSpacing={0}>
              难度 {n.diff}/5
            </tspan>
          </text>
        </>
      ) : (
        <text x={n.x + 13} y={n.cy + 4.5} fontSize={13} fontWeight={fw} fill={tcol}>
          {n.label}
        </text>
      )}
      {n.hasChild && (
        <>
          <circle cx={n.x + n.w} cy={n.cy} r={7.5} fill="#fff" stroke={stroke} strokeWidth={1.5} />
          <text
            x={n.x + n.w}
            y={n.cy + 3.8}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={stroke}
          >
            {n.expanded ? '−' : '+'}
          </text>
        </>
      )}
    </g>
  )
}

export default function CatalogTree({ lessons, selectedTopics }: CatalogTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(0.95)

  const root = useMemo(() => buildMapData(lessons, selectedTopics), [lessons, selectedTopics])
  const layout = useMemo(() => layoutMap(root, expanded), [root, expanded])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expandTopics = () => setExpanded(new Set(collectIds(root, (n) => n.kind === 'topic')))
  const expandAll = () => setExpanded(new Set(collectIds(root, () => true)))
  const collapseAll = () => setExpanded(new Set())
  const zoomIn = () => setZoom((z) => Math.min(1.8, z * 1.2))
  const zoomOut = () => setZoom((z) => Math.max(0.4, z / 1.2))

  const empty = root.children.length === 0
  const btn =
    'rounded-lg border border-[#4361ee] bg-white px-2.5 py-1.5 text-xs text-[#4361ee] transition hover:bg-[#4361ee]/5'

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-[0_2px_14px_rgba(30,40,80,.08)]">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="flex-[1_1_260px] px-0 py-1 text-[13px] text-[#6b7688]">
          XMind 思维导图：<b>中心 → 题型 → 书籍 → 讲次 → 难度</b>，按难度降序。点节点 ＋/− 展开收起，可横向/纵向滚动。
        </span>
        <button className={btn} onClick={expandTopics}>
          展开到书
        </button>
        <button className={btn} onClick={expandAll}>
          全部展开
        </button>
        <button className={btn} onClick={collapseAll}>
          全部收起
        </button>
        <button className={btn} onClick={zoomOut}>
          －
        </button>
        <button className={btn} onClick={zoomIn}>
          ＋
        </button>
      </div>
      <div className="px-3.5 pt-1 pb-3 text-[13px] text-[#6b7688]">
        {empty ? (
          ''
        ) : (
          <>
            共 <b>{layout.topicCount}</b> 个题型（按难度降序）｜ 点击节点 <b>＋/−</b> 展开或收起
          </>
        )}
      </div>
      <div className="max-h-[74vh] overflow-auto rounded-xl border border-[#e6e9f0] bg-[#fafbfe] [background-image:radial-gradient(#e7ebf4_1px,transparent_1px)] [background-size:22px_22px]">
        {empty ? (
          <svg width={260} height={60} xmlns="http://www.w3.org/2000/svg">
            <text x={20} y={34} fill="#6b7688" fontSize={14}>
              无匹配内容，调整筛选试试。
            </text>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={Math.round(layout.width * zoom)}
            height={Math.round(layout.height * zoom)}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="block"
          >
            {layout.edges.map((e, i) => (
              <path
                key={i}
                d={e.d}
                fill="none"
                stroke={e.color}
                strokeWidth={2}
                opacity={0.55}
              />
            ))}
            {layout.nodes.map((n) => (
              <NodeShape key={n.id} n={n} onToggle={toggle} />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
