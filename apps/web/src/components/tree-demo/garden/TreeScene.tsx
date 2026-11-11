'use client'

import { forwardRef, useImperativeHandle, useRef, type KeyboardEvent, type ReactNode } from 'react'
import {
  GROUND_Y,
  TRUNK_TOP_Y,
  TREE_VIEW_BOX,
  trunkHalfWidth,
  type PlacedItem,
  type Region,
} from './layout'
import { SUBJECTS, type Apple, type Bud, type Flower, type GardenState, type SubjectKey } from './model'

export type ItemKind = 'apple' | 'flower' | 'bud'
export type FreshKind = 'born' | 'wiggle'

export interface TreeSceneHandle {
  /** SVG 坐标换成浏览器视口坐标 */
  toClient: (x: number, y: number) => { x: number; y: number } | null
  /** 树冠区域的视口矩形，环境花瓣用 */
  crownRect: () => DOMRect | null
}

type Props = {
  state: GardenState
  regions: Region[]
  fresh: Record<string, FreshKind>
  /** 种子还在飞的花，先不画 */
  hidden: ReadonlySet<string>
  onItem: (kind: ItemKind, id: string, rect: DOMRect) => void
  onParked: () => void
}

const PETAL: Record<SubjectKey, { light: string; deep: string }> = {
  chinese: { light: '#ffc2d1', deep: '#f06595' },
  math: { light: '#fff0a8', deep: '#ffb300' },
  english: { light: '#bfe0ff', deep: '#4dabf7' },
  life: { light: '#c4f5c9', deep: '#40c057' },
}

const APPLE_PATH = 'M0 -10 C-12 -16 -17 -2 -13 6 C-9 15 -3 15 0 13 C3 15 9 15 13 6 C17 -2 12 -16 0 -10Z'
const RAINBOW_BANDS = ['#ff6b6b', '#ffb84d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc']

/** 估一个标签的宽度：汉字按一个字号宽，其余按半个 */
function textWidth(text: string, size: number): number {
  let w = 0
  for (const ch of text) w += ch.charCodeAt(0) > 255 ? size : size * 0.58
  return w
}

/** 渐变和光晕：沿用泡泡愿望树 demo 的画法 */
function Defs() {
  // visual-ok: 插画渐变（SVG），不是 UI 控件
  const subjects = Object.keys(SUBJECTS) as SubjectKey[]
  return (
    <defs>
      <linearGradient id="tg-trunk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a573a" />
        <stop offset="0.45" stopColor="#b88255" />
        <stop offset="1" stopColor="#7a4a2e" />
      </linearGradient>
      <radialGradient id="tg-leaf-back" cx="0.4" cy="0.3" r="1.1">
        <stop offset="0" stopColor="#6fbf63" />
        <stop offset="1" stopColor="#3f8f47" />
      </radialGradient>
      <radialGradient id="tg-leaf-front" cx="0.38" cy="0.28" r="1.15">
        <stop offset="0" stopColor="#b9ec84" />
        <stop offset="0.55" stopColor="#7ccf6a" />
        <stop offset="1" stopColor="#54ad55" />
      </radialGradient>
      <radialGradient id="tg-leaf-top" cx="0.4" cy="0.3" r="1.1">
        <stop offset="0" stopColor="#e4fbb4" />
        <stop offset="1" stopColor="#8fdd77" />
      </radialGradient>
      <radialGradient id="tg-leaf-old" cx="0.4" cy="0.3" r="1.1">
        <stop offset="0" stopColor="#c3cfae" />
        <stop offset="1" stopColor="#7f9473" />
      </radialGradient>
      <radialGradient id="tg-glow-gold">
        <stop offset="0" stopColor="#ffe28a" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ffe28a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tg-glow-white">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tg-ground">
        <stop offset="0" stopColor="#2f5e2a" stopOpacity="0.4" />
        <stop offset="1" stopColor="#2f5e2a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tg-bud" cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#d6f7b3" />
        <stop offset="1" stopColor="#5dbb63" />
      </radialGradient>
      <radialGradient id="tg-bud-gray" cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#ece8de" />
        <stop offset="1" stopColor="#aaa496" />
      </radialGradient>
      <radialGradient id="tg-center" cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fff3c4" />
        <stop offset="1" stopColor="#ffc933" />
      </radialGradient>
      <linearGradient id="tg-leafblade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8fdd77" />
        <stop offset="1" stopColor="#4d9c46" />
      </linearGradient>
      <linearGradient id="tg-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9a073" />
        <stop offset="1" stopColor="#a8693f" />
      </linearGradient>
      {subjects.map((k) => (
        <radialGradient key={`ap-${k}`} id={`tg-apple-${k}`} cx="0.34" cy="0.28" r="0.95">
          <stop offset="0" stopColor={SUBJECTS[k].tint} />
          <stop offset="0.5" stopColor={SUBJECTS[k].color} />
          <stop offset="1" stopColor={SUBJECTS[k].deep} />
        </radialGradient>
      ))}
      {subjects.map((k) => (
        <linearGradient key={`pt-${k}`} id={`tg-petal-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PETAL[k].light} />
          <stop offset="1" stopColor={PETAL[k].deep} />
        </linearGradient>
      ))}
      <linearGradient id="tg-rainbow" x1="0" y1="0" x2="0" y2="1">
        {RAINBOW_BANDS.map((c, i) => (
          <stop key={c} offset={i / (RAINBOW_BANDS.length - 1)} stopColor={c} />
        ))}
      </linearGradient>
      <clipPath id="tg-apple-clip">
        <path d={APPLE_PATH} />
      </clipPath>
    </defs>
  )
}

function AppleShape({ apple }: { apple: Apple }) {
  const rainbow = apple.kind === 'rainbow'
  return (
    <g className="tg-apple-bob">
      <circle className="tg-glow" r="26" fill="url(#tg-glow-gold)" opacity={rainbow ? 1 : 0.7} />
      {rainbow && (
        <circle className="tg-rainbow-ring" r="22" fill="none" stroke="#ffd43b" strokeWidth="2.4" strokeDasharray="4 4" />
      )}
      <path
        d={APPLE_PATH}
        fill={rainbow ? 'url(#tg-rainbow)' : `url(#tg-apple-${apple.kind})`}
        stroke={apple.kind === 'rainbow' ? '#9c36b5' : SUBJECTS[apple.kind].deep}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <ellipse cx="-6.5" cy="-3" rx="2.8" ry="5" fill="#ffffff" opacity="0.65" transform="rotate(-20 -6.5 -3)" />
      <path d="M0 -10 Q1 -16 4 -18" stroke="#7a4a2e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M2 -14 Q9 -21 14 -13 Q8 -10 2 -14Z" fill="url(#tg-leafblade)" stroke="#2f7a3a" strokeWidth="1" />
    </g>
  )
}

function FlowerShape({ flower }: { flower: Flower }) {
  const k = flower.subject
  return (
    <g className="tg-flower" data-stage={flower.stage}>
      <circle className="tg-halo" r="26" fill="url(#tg-glow-gold)" />
      <g className="tg-petals">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse
            key={i}
            cx="0"
            cy="-8.5"
            rx="5.8"
            ry="8.4"
            transform={`rotate(${i * 60})`}
            fill={`url(#tg-petal-${k})`}
            stroke={PETAL[k].deep}
            strokeWidth="0.9"
            strokeOpacity="0.7"
          />
        ))}
      </g>
      <circle r="5.4" fill="url(#tg-center)" stroke="#e8a013" strokeWidth="1" />
      <ellipse cx="-1.6" cy="-2" rx="1.8" ry="1.1" fill="#ffffff" opacity="0.8" />
    </g>
  )
}

function BudShape({ bud, inBubble }: { bud: Bud; inBubble: boolean }) {
  const meta = SUBJECTS[bud.subject]
  const gray = bud.overdue
  return (
    <g>
      {inBubble && <circle r="18" fill="url(#tg-glow-white)" stroke="#74c0fc" strokeWidth="2" strokeDasharray="4 3" />}
      <path
        d="M0 -12 C8 -5 9 3 0 10 C-9 3 -8 -5 0 -12Z"
        fill={gray ? 'url(#tg-bud-gray)' : 'url(#tg-bud)'}
        stroke={gray ? '#8a8478' : '#3f8f47'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M0 10 L0 14" stroke={gray ? '#8a8478' : '#3f8f47'} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="-3" cy="-5" rx="1.6" ry="3" fill="#ffffff" opacity="0.6" transform="rotate(-18 -3 -5)" />
      <circle cy="-1" r="3.2" fill={gray ? '#8a8478' : meta.color} stroke="#ffffff" strokeWidth="1.2" />
    </g>
  )
}

function itemLabel(kind: ItemKind, state: GardenState, id: string): string {
  if (kind === 'apple') {
    const a = state.apples.find((x) => x.id === id)
    return a ? (a.kind === 'rainbow' ? '彩虹果' : `${SUBJECTS[a.kind].label}苹果`) : '苹果'
  }
  if (kind === 'flower') {
    const f = state.flowers.find((x) => x.id === id)
    return f ? `${SUBJECTS[f.subject].label}花：${f.name}` : '花'
  }
  const b = state.buds.find((x) => x.id === id)
  return b ? `${b.overdue ? '灰色花苞' : '花苞'}：${b.name}` : '花苞'
}

function RegionLabel({ region }: { region: Region }) {
  const { cx, cy, ry } = region.geom
  const today = region.tone === 'today'
  const lines: string[] = [`${region.label} ${region.sub}`]
  if (region.tone !== 'history') lines.push(`已排 ${region.load}/${region.capacity}`)
  const size = today ? 14 : 12
  const w = Math.max(...lines.map((l) => textWidth(l, size))) + 18
  const h = lines.length * (size + 4) + 8
  const y = cy + ry * (today ? 1.0 : 0.98)
  const full = region.tone !== 'history' && region.load >= region.capacity
  return (
    <g pointerEvents="none">
      <rect
        x={cx - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2.2}
        fill={today ? '#ffd54a' : '#fff8ec'}
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      <rect
        x={cx - w / 2 + 1}
        y={y - h / 2 + 1}
        width={w - 2}
        height={h - 2}
        rx={h / 2.2}
        fill="none"
        stroke={today ? '#e8a013' : region.stroke}
        strokeWidth="1.4"
        opacity="0.85"
      />
      {lines.map((l, i) => (
        <text
          key={l}
          x={cx}
          y={y - h / 2 + 5 + (i + 1) * (size + 4) - 4}
          textAnchor="middle"
          fontSize={i === 0 ? size : size - 1}
          fontWeight={i === 0 ? 800 : 600}
          fill={i === 1 && full ? '#c92a2a' : '#4a3728'}
        >
          {l}
        </text>
      ))}
    </g>
  )
}

/** 后层树冠：叶区之间露出来的深绿，还有填缝的亮叶团，让整棵树鼓鼓的 */
const BACK_PUFFS: [number, number, number, number][] = [
  [320, 150, 170, 110],
  [150, 230, 130, 96],
  [490, 230, 130, 96],
  [320, 300, 190, 80],
  [90, 300, 70, 60],
  [550, 300, 70, 60],
]
const FILL_PUFFS: [number, number, number, number][] = [
  [255, 215, 92, 62],
  [385, 215, 92, 62],
  [320, 305, 98, 65],
  [150, 200, 70, 50],
  [490, 200, 70, 50],
]

const TreeScene = forwardRef<TreeSceneHandle, Props>(function TreeScene(
  { state, regions, fresh, hidden, onItem, onParked },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const crownRef = useRef<SVGEllipseElement>(null)
  const parked = state.buds.filter((b) => b.dateKey === null).length

  useImperativeHandle(ref, () => ({
    toClient(x, y) {
      const svg = svgRef.current
      const m = svg?.getScreenCTM()
      if (!svg || !m) return null
      const pt = new DOMPoint(x, y).matrixTransform(m)
      return { x: pt.x, y: pt.y }
    },
    crownRect: () => crownRef.current?.getBoundingClientRect() ?? null,
  }))

  function fire(kind: ItemKind, id: string, el: Element): void {
    onItem(kind, id, el.getBoundingClientRect())
  }

  function renderItem(region: Region, placed: PlacedItem) {
    const { item, x, y } = placed
    if (hidden.has(item.id)) return null
    const kind: ItemKind = item.kind
    const freshKind = fresh[item.id]
    const label = itemLabel(kind, state, item.id)
    let body: ReactNode = null
    if (item.kind === 'apple') {
      const a = state.apples.find((v) => v.id === item.id)
      if (a) body = <AppleShape apple={a} />
    } else if (item.kind === 'flower') {
      const f = state.flowers.find((v) => v.id === item.id)
      if (f) body = <FlowerShape flower={f} />
    } else {
      const b = state.buds.find((v) => v.id === item.id)
      if (b) body = <BudShape bud={b} inBubble={state.bubbles.includes(b.id)} />
    }
    if (!body) return null
    return (
      <g
        key={`${item.kind}-${item.id}`}
        className="tg-item"
        role="button"
        tabIndex={0}
        aria-label={label}
        transform={`translate(${x} ${y}) scale(${region.scale})`}
        onClick={(e) => fire(kind, item.id, e.currentTarget)}
        onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fire(kind, item.id, e.currentTarget)
          }
        }}
      >
        <title>{label}</title>
        <circle className="tg-focus" r="19" fill="transparent" stroke="transparent" />
        <g className={freshKind === 'born' ? 'tg-born' : freshKind === 'wiggle' ? 'tg-wiggle' : undefined}>
          <g className="tg-item-body">{body}</g>
        </g>
      </g>
    )
  }

  const ringCount = Math.min(state.rings, 9)

  return (
    <svg
      ref={svgRef}
      viewBox={TREE_VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-visible"
      role="group"
      aria-label="时间成长树"
    >
      <Defs />

      <ellipse cx="320" cy={GROUND_Y + 4} rx="230" ry="20" fill="url(#tg-ground)" />

      <g className="tg-tree-sway">
        {/* 后层树冠 */}
        <g>
          {BACK_PUFFS.map(([cx, cy, rx, ry], i) => (
            <ellipse key={`bp-${i}`} ref={i === 0 ? crownRef : undefined} cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#tg-leaf-back)" />
          ))}
        </g>

        {/* 树枝：从树干连到每片叶区，先描深色边再画亮色 */}
        {[
          { w: 3, stroke: '#6d3f24' },
          { w: 0, stroke: '#a8714a' },
        ].map(({ w, stroke }) => (
          <g key={stroke} stroke={stroke} strokeLinecap="round" fill="none">
            {regions.map((r) => {
              const hist = r.tone === 'history'
              return (
                <path
                  key={`br-${r.key}`}
                  d={`M320 ${hist ? 440 : 306} Q${(320 + r.geom.cx) / 2} ${r.geom.cy + 44} ${r.geom.cx} ${r.geom.cy}`}
                  strokeWidth={(hist ? 7 : 11) + w * 2}
                />
              )
            })}
          </g>
        ))}

        {/* 树干 */}
        <path
          d={`M276 ${GROUND_Y + 4} C284 520 294 450 300 380 C304 330 304 300 306 ${TRUNK_TOP_Y} L334 ${TRUNK_TOP_Y} C336 300 336 330 340 380 C346 450 356 520 364 ${GROUND_Y + 4} C340 ${GROUND_Y + 12} 300 ${GROUND_Y + 12} 276 ${GROUND_Y + 4} Z`}
          fill="url(#tg-trunk)"
          stroke="#6d3f24"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M296 470 C300 468 304 470 306 474" stroke="#6d3f24" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M338 500 C342 498 346 500 348 504" stroke="#6d3f24" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
        {Array.from({ length: ringCount }, (_, i) => {
          const y = 540 - i * 24
          const hw = trunkHalfWidth(y)
          return (
            <path
              key={`ring-${i}`}
              d={`M${320 - hw + 3} ${y} Q320 ${y + 9} ${320 + hw - 3} ${y}`}
              stroke="#6d3f24"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
              opacity="0.55"
            />
          )
        })}

        {/* 树的脸 */}
        <g pointerEvents="none">
          <ellipse className="tg-eye" cx="308" cy="392" rx="4.4" ry="5.8" fill="#4a2c17" />
          <ellipse className="tg-eye" cx="332" cy="392" rx="4.4" ry="5.8" fill="#4a2c17" />
          <circle cx="298" cy="405" r="5" fill="#ff9d9d" opacity="0.55" />
          <circle cx="342" cy="405" r="5" fill="#ff9d9d" opacity="0.55" />
          <path d="M312 404 Q320 413 328 404" stroke="#4a2c17" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </g>

        {/* 填缝的亮叶团 */}
        <g>
          {FILL_PUFFS.map(([cx, cy, rx, ry], i) => (
            <ellipse key={`fp-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#tg-leaf-front)" />
          ))}
        </g>

        {/* 叶区：历史 → 远的天 → 今天 */}
        {regions.map((r) => {
          const { cx, cy, rx, ry } = r.geom
          const hist = r.tone === 'history'
          const today = r.tone === 'today'
          return (
            <g key={r.key} className="tg-region" opacity={hist ? 0.95 : 1}>
              {today && <ellipse cx={cx} cy={cy} rx={rx + 34} ry={ry + 30} fill="url(#tg-glow-gold)" opacity="0.8" />}
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={hist ? 'url(#tg-leaf-old)' : today ? 'url(#tg-leaf-top)' : 'url(#tg-leaf-front)'}
              />
              {/* 星期色：叶面一层淡淡的底色和描边，认得出是周几 */}
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={r.fill} opacity={hist ? 0.1 : 0.14} />
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill="none"
                stroke={r.stroke}
                strokeWidth={today ? 4 : 3}
                strokeOpacity={hist ? 0.55 : 0.9}
              />
              <ellipse
                cx={cx - rx * 0.28}
                cy={cy - ry * 0.55}
                rx={rx * 0.42}
                ry={ry * 0.16}
                fill="#ffffff"
                opacity="0.32"
                transform={`rotate(-12 ${cx - rx * 0.28} ${cy - ry * 0.55})`}
              />
              {today && (
                <ellipse
                  className="tg-today-ring"
                  cx={cx}
                  cy={cy}
                  rx={rx + 8}
                  ry={ry + 8}
                  fill="none"
                  stroke="#ffb300"
                  strokeWidth="3.5"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                />
              )}
              {r.placed.map((p) => renderItem(r, p))}
              {r.overflow > 0 && (
                <g pointerEvents="none">
                  <circle cx={cx + rx * 0.72} cy={cy - ry * 0.55} r="11" fill="#fff8ec" stroke={r.stroke} strokeWidth="2" />
                  <text x={cx + rx * 0.72} y={cy - ry * 0.55 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#4a3728">
                    +{r.overflow}
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {/* 日期小牌最后画，不被相邻的叶区盖住 */}
        {regions.map((r) => (
          <RegionLabel key={`label-${r.key}`} region={r} />
        ))}
      </g>

      {/* 「先不做」收纳箱 */}
      <g
        className="tg-item"
        role="button"
        tabIndex={0}
        aria-label={`先不做，${parked} 件`}
        transform="translate(28 488)"
        onClick={onParked}
        onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onParked()
          }
        }}
      >
        <circle className="tg-focus" cx="45" cy="30" r="52" fill="transparent" stroke="transparent" />
        <g className="tg-item-body">
          <rect x="0" y="8" width="90" height="52" rx="10" fill="url(#tg-wood)" stroke="#8a573a" strokeWidth="3" />
          <path d="M0 24 H90 M0 42 H90" stroke="#8a573a" strokeWidth="2" opacity="0.6" />
          <text x="45" y="38" textAnchor="middle" fontSize="15" fontWeight="800" fill="#ffffff" stroke="#6d3f24" strokeWidth="0.8">
            先不做
          </text>
          <circle cx="86" cy="10" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
          <text x="86" y="15" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffffff">
            {parked}
          </text>
        </g>
      </g>
    </svg>
  )
})

export default TreeScene
