import { useState } from 'react'

// ─── SVG figures ──────────────────────────────────────────────────────────────

function CubeFigure({ label }: { label?: string }) {
  // front-face: A(60,190) B(180,190) C(60,80) D(180,80)
  // back-face offset: +50, -40 → E(110,150) F(230,150) G(110,40) H(230,40)
  return (
    <svg viewBox="0 0 270 220" className="h-full w-full">
      {label && (
        <text x="14" y="28" fontSize="13" fontWeight="600" fill="#be185d">
          {label}
        </text>
      )}
      {/* dashed back edges */}
      <line
        x1="110"
        y1="150"
        x2="230"
        y2="150"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="110"
        y1="40"
        x2="110"
        y2="150"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="110"
        y1="40"
        x2="230"
        y2="40"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      {/* solid front face */}
      <rect
        x="60"
        y="80"
        width="120"
        height="110"
        rx="0"
        fill="none"
        stroke="#ec4899"
        strokeWidth="2"
      />
      {/* top face */}
      <line x1="60" y1="80" x2="110" y2="40" stroke="#ec4899" strokeWidth="2" />
      <line x1="180" y1="80" x2="230" y2="40" stroke="#ec4899" strokeWidth="2" />
      <line x1="110" y1="40" x2="230" y2="40" stroke="#ec4899" strokeWidth="2" />
      {/* right face */}
      <line x1="180" y1="190" x2="230" y2="150" stroke="#ec4899" strokeWidth="2" />
      <line x1="230" y1="150" x2="230" y2="40" stroke="#ec4899" strokeWidth="2" />
      {/* vertices */}
      {[
        [60, 190, 'A', -16, 0],
        [180, 190, 'B', 8, 0],
        [60, 80, 'C', -16, 0],
        [180, 80, 'D', 8, -6],
        [110, 150, 'E', 6, 10],
        [230, 150, 'F', 8, 6],
        [110, 40, 'G', -16, -4],
        [230, 40, 'H', 8, -4],
      ].map(([cx, cy, lbl, dx, dy]) => (
        <g key={lbl as string}>
          <circle cx={cx as number} cy={cy as number} r="3.5" fill="#ec4899" />
          <text
            x={(cx as number) + (dx as number)}
            y={(cy as number) + (dy as number) + 4}
            fontSize="11"
            fill="#9d174d"
            fontWeight="600"
          >
            {lbl as string}
          </text>
        </g>
      ))}
    </svg>
  )
}

const Door = ({ x, y, horiz }: { x: number; y: number; horiz: boolean }) =>
  horiz ? (
    <line x1={x} y1={y} x2={x + 14} y2={y} stroke="#fff" strokeWidth="3" />
  ) : (
    <line x1={x} y1={y} x2={x} y2={y + 14} stroke="#fff" strokeWidth="3" />
  )

function RectBoxFigure() {
  // A-labeled cuboid, slightly wider
  // front: (70,160) (200,160) (70,70) (200,70)
  // back offset +45,-35
  return (
    <svg viewBox="0 0 280 210" className="h-full w-full">
      {/* dashed back */}
      <line
        x1="115"
        y1="125"
        x2="245"
        y2="125"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="115"
        y1="35"
        x2="115"
        y2="125"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="115"
        y1="35"
        x2="245"
        y2="35"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      {/* front face */}
      <rect x="70" y="70" width="130" height="90" fill="none" stroke="#ec4899" strokeWidth="2" />
      {/* top */}
      <line x1="70" y1="70" x2="115" y2="35" stroke="#ec4899" strokeWidth="2" />
      <line x1="200" y1="70" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />
      <line x1="115" y1="35" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />
      {/* right */}
      <line x1="200" y1="160" x2="245" y2="125" stroke="#ec4899" strokeWidth="2" />
      <line x1="245" y1="125" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />
      {/* A label at front-top-left */}
      <circle cx="70" cy="70" r="3.5" fill="#ec4899" />
      <text x="48" y="72" fontSize="13" fontWeight="700" fill="#be185d">
        A
      </text>
    </svg>
  )
}

// Museum floorplan for problem 3
function MuseumFigure() {
  const W = 480,
    H = 240
  // Outer wall
  // Rooms inside: rough replica of the PDF layout
  // door = short gap in a wall segment (rendered as a notch)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {/* outer rectangle */}
      <rect
        x="20"
        y="10"
        width={W - 60}
        height={H - 50}
        fill="none"
        stroke="#be185d"
        strokeWidth="2"
      />

      {/* interior vertical dividers */}
      <line x1="160" y1="10" x2="160" y2={H - 50} stroke="#be185d" strokeWidth="1.5" />
      <line x1="280" y1="10" x2="280" y2={H - 50} stroke="#be185d" strokeWidth="1.5" />

      {/* interior horizontal dividers */}
      <line x1="20" y1="100" x2="160" y2="100" stroke="#be185d" strokeWidth="1.5" />
      <line x1="160" y1="80" x2="280" y2="80" stroke="#be185d" strokeWidth="1.5" />
      <line x1="280" y1="120" x2={W - 60} y2="120" stroke="#be185d" strokeWidth="1.5" />

      {/* doors as white gaps + tick marks */}
      {/* top wall doors */}
      <Door x={80} y={10} horiz={true} />
      <Door x={210} y={10} horiz={true} />
      <Door x={330} y={10} horiz={true} />
      {/* left wall */}
      <Door x={20} y={55} horiz={false} />
      {/* right wall */}
      <Door x={W - 60} y={60} horiz={false} />
      {/* bottom wall */}
      <Door x={90} y={H - 50} horiz={true} />
      <Door x={220} y={H - 50} horiz={true} />
      {/* internal horizontal top */}
      <Door x={60} y={100} horiz={true} />
      <Door x={100} y={100} horiz={true} />
      <Door x={195} y={80} horiz={true} />
      <Door x={310} y={120} horiz={true} />
      {/* internal vertical */}
      <Door x={160} y={40} horiz={false} />
      <Door x={160} y={130} horiz={false} />
      <Door x={280} y={30} horiz={false} />
      <Door x={280} y={140} horiz={false} />

      {/* diagonal doors (slanted lines) */}
      <line x1="130" y1="130" x2="150" y2="150" stroke="#be185d" strokeWidth="1.5" />
      <line x1="200" y1="110" x2="218" y2="128" stroke="#be185d" strokeWidth="1.5" />
      <line x1="250" y1="95" x2="268" y2="112" stroke="#be185d" strokeWidth="1.5" />

      {/* 入口 label */}
      <text x={W - 54} y={H - 24} fontSize="12" fill="#9d174d" fontWeight="600">
        入口
      </text>
      <rect x={W - 60} y={H - 50} width="10" height="20" fill="#be185d" />
    </svg>
  )
}

// Exhibition hall for problem 4 (5 rooms with entrance/exit)
function ExhibitFigure() {
  const W = 400,
    H = 200

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {/* outer */}
      <rect
        x="20"
        y="20"
        width={W - 40}
        height={H - 60}
        fill="none"
        stroke="#be185d"
        strokeWidth="2"
      />
      {/* 2 vertical dividers → 3 columns */}
      <line x1="140" y1="20" x2="140" y2={H - 60} stroke="#be185d" strokeWidth="1.5" />
      <line x1="260" y1="20" x2="260" y2={H - 60} stroke="#be185d" strokeWidth="1.5" />
      {/* horizontal mid in left & right columns */}
      <line x1="20" y1="80" x2="140" y2="80" stroke="#be185d" strokeWidth="1.5" />
      <line x1="260" y1="80" x2={W - 20} y2="80" stroke="#be185d" strokeWidth="1.5" />

      {/* doors between rooms (top walls) */}
      <Door x={70} y={20} horiz={true} />
      <Door x={190} y={20} horiz={true} />
      <Door x={300} y={20} horiz={true} />
      {/* left wall */}
      <Door x={20} y={45} horiz={false} />
      {/* right wall */}
      <Door x={W - 20} y={45} horiz={false} />
      {/* internal horizontal */}
      <Door x={55} y={80} horiz={true} />
      <Door x={285} y={80} horiz={true} />
      {/* vertical dividers */}
      <Door x={140} y={40} horiz={false} />
      <Door x={140} y={95} horiz={false} />
      <Door x={260} y={40} horiz={false} />
      <Door x={260} y={95} horiz={false} />

      {/* bottom: entrance + exit */}
      <Door x={60} y={H - 60} horiz={true} />
      <Door x={290} y={H - 60} horiz={true} />
      <text x={48} y={H - 28} fontSize="11" fill="#9d174d" fontWeight="600">
        入口
      </text>
      <text x={275} y={H - 28} fontSize="11" fill="#9d174d" fontWeight="600">
        出口
      </text>
    </svg>
  )
}

// Street map for problem 5 (grid with labeled distances)
function StreetMapFigure() {
  // 1 row × 5 columns of blocks
  // horizontal segment widths: 3, 4, 2, 1, 4 (km)
  // vertical height: 5 (km)
  const scale = 30
  const xs = [40, 40 + 3 * scale, 40 + 7 * scale, 40 + 9 * scale, 40 + 10 * scale, 40 + 14 * scale]
  const y0 = 30,
    y1 = 30 + 5 * scale
  const widths = [3, 4, 2, 1, 4]

  return (
    <svg viewBox="0 0 520 230" className="h-full w-full">
      {/* vertical lines */}
      {xs.map((x, i) => (
        <line key={i} x1={x} y1={y0} x2={x} y2={y1} stroke="#16a34a" strokeWidth="2" />
      ))}
      {/* horizontal top and bottom */}
      <line x1={xs[0]} y1={y0} x2={xs[5]} y2={y0} stroke="#16a34a" strokeWidth="2" />
      <line x1={xs[0]} y1={y1} x2={xs[5]} y2={y1} stroke="#16a34a" strokeWidth="2" />

      {/* top distance labels */}
      {widths.map((w, i) => (
        <text
          key={i}
          x={(xs[i] + xs[i + 1]) / 2}
          y={y0 - 8}
          fontSize="13"
          fontWeight="700"
          fill="#15803d"
          textAnchor="middle"
        >
          {w}
        </text>
      ))}
      {/* left height label */}
      <text
        x={xs[0] - 18}
        y={(y0 + y1) / 2 + 5}
        fontSize="13"
        fontWeight="700"
        fill="#15803d"
        textAnchor="middle"
      >
        5
      </text>

      {/* starting point marker */}
      <circle cx={xs[0]} cy={y1} r="5" fill="#15803d" />
      <text x={xs[0]} y={y1 + 20} fontSize="12" fill="#15803d" fontWeight="600" textAnchor="middle">
        起点
      </text>
    </svg>
  )
}

// ─── Problem cards ─────────────────────────────────────────────────────────────

interface Problem {
  id: number
  title: string
  body: string
  figure: React.ReactNode
  figureAspect: string // tailwind aspect
}

const problems: Problem[] = [
  {
    id: 1,
    title: '问题一',
    body: '一只蚂蚁沿正方体的棱爬行，经过所有的顶点，且它没有重复走任何一条棱最后回到出发点。那么它至少有几条棱没有经过？',
    figure: <CubeFigure />,
    figureAspect: 'aspect-[4/3]',
  },
  {
    id: 2,
    title: '问题二',
    body: '一条小虫从 A 点出发，沿长 6 厘米、宽 4 厘米、高 5 厘米的长方体的棱爬行，它没有重复走任何一条棱，那么它最多能爬多少厘米？',
    figure: <RectBoxFigure />,
    figureAspect: 'aspect-[4/3]',
  },
  {
    id: 3,
    title: '问题三',
    body: '下图是一座博物馆的示意图，游客从入口进入博物馆。是否能找到一条参观路线，穿过所有的门并且每扇门恰好经过一次？',
    figure: <MuseumFigure />,
    figureAspect: 'aspect-[2/1]',
  },
  {
    id: 4,
    title: '问题四',
    body: '下图是某展厅的平面图，它由五个展室组成，任意两展室之间都有门相通，整个展览厅还有一个进口和一个出口，那么游客能否一次不重复地穿过所有的门，并且从入口进，从出口出？',
    figure: <ExhibitFigure />,
    figureAspect: 'aspect-[2/1]',
  },
  {
    id: 5,
    title: '问题五',
    body: '假期中的一天，老师带着同学们乘观光车游览野生动物园，大巴车从起点出发，走遍每一条街道最后回到起点，大巴车所走的最短路程是多少千米？',
    figure: <StreetMapFigure />,
    figureAspect: 'aspect-[3/1]',
  },
]

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function MathProblems() {
  const [active, setActive] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-[#fdf2f8] font-sans">
      {/* PWA meta injection (handled outside in index.html normally) */}
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-pink-100 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-600">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9" />
            <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6" />
            <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6" />
            <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm leading-none font-bold text-pink-900">第5次课 · 附加讲义</h1>
          <p className="mt-0.5 text-[11px] text-pink-400">一笔画问题</p>
        </div>
        <span className="ml-auto font-mono text-xs text-pink-300">5题</span>
      </header>
      {/* Problem list */}
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {problems.map((p) => {
          const isOpen = active === p.id
          return (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm transition-all duration-300"
              style={{ boxShadow: isOpen ? '0 4px 24px rgba(236,72,153,0.10)' : undefined }}
            >
              {/* Card header */}
              <button
                onClick={() => setActive(isOpen ? null : p.id)}
                className="group flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-200 bg-pink-50 text-sm font-bold text-pink-700 transition-colors group-hover:bg-pink-100">
                  {p.id}
                </span>
                <span className="line-clamp-2 flex-1 text-[13px] leading-snug font-semibold text-pink-900">
                  {p.body.slice(0, 38)}…
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`shrink-0 text-pink-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path
                    d="M3 6l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-pink-50 px-5 pb-6">
                  {/* Full problem text */}
                  <p className="mt-4 text-sm leading-relaxed text-gray-700">{p.body}</p>

                  {/* Figure */}
                  <div className={`mt-4 ${p.figureAspect} mx-auto w-full max-w-sm`}>{p.figure}</div>

                  {/* Hint chip */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-100 bg-pink-50 px-3 py-1 text-[11px] font-medium text-pink-700">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1" />
                        <path
                          d="M5 3v3M5 7.5v.5"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                        />
                      </svg>
                      一笔画 · 欧拉图理论
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </main>
      {/* Bottom nav bar (PWA feel) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-pink-100 bg-white/90 py-2 backdrop-blur">
        {['题目', '笔记', '练习'].map((label, i) => (
          <button
            key={label}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-[11px] font-medium transition-colors ${
              i === 0 ? 'text-pink-600' : 'text-gray-400'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {i === 0 && (
                <path
                  d="M4 5h12M4 10h8M4 15h10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
              {i === 1 && (
                <path
                  d="M6 4h8a1 1 0 011 1v11a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1zm2 4h4M8 10h4M8 13h2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              )}
              {i === 2 && <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.6" />}
            </svg>
            {label}
          </button>
        ))}
      </nav>
      <div className="h-20" /> {/* spacer for bottom nav */}
    </div>
  )
}
