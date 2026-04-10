// Three figures for minimum-stroke count problem
// Fig1: pentagon + internal diagonals (4 odd vertices → 2 strokes)
// Fig2: circle + 8 spokes + ring (8 odd vertices → 4 strokes)
// Fig3: row of 3 houses (8 odd vertices → 4 strokes)
function HomeworkFig4() {
  // Pentagon: 5 vertices, fully connected internally → 4 odd vertices at outer degree
  // Center of fig1: (65, 95)
  const pR = 45
  const pc = { x: 65, y: 95 }
  const pPts = Array.from({ length: 5 }, (_, i) => ({
    x: pc.x + pR * Math.sin((2 * Math.PI * i) / 5 - Math.PI / 2),
    y: pc.y - pR * Math.cos((2 * Math.PI * i) / 5 - Math.PI / 2),
  }))

  return (
    <svg viewBox="0 0 360 180" className="h-full w-full">
      {/* ── Figure 1: Pentagon with all diagonals ── */}
      {/* Outer pentagon */}
      <polygon
        points={pPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
      />
      {/* All diagonals */}
      {pPts.map((a, i) =>
        pPts.slice(i + 2, i === 0 ? -1 : undefined).map((b, j) => (
          <line
            key={`d${i}-${j}`}
            x1={a.x.toFixed(1)}
            y1={a.y.toFixed(1)}
            x2={b.x.toFixed(1)}
            y2={b.y.toFixed(1)}
            stroke="#f59e0b"
            strokeWidth="2"
          />
        ))
      )}
      {/* Vertex dots */}
      {pPts.map((p, i) => (
        <circle key={`v${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill="#f59e0b" />
      ))}
      <text x="65" y="170" fontSize="11" fill="#b45309" textAnchor="middle">4÷2=2笔</text>

      {/* ── Figure 2: Circle + 8 spokes + inner ring ── */}
      <circle cx="185" cy="90" r="50" fill="none" stroke="#f59e0b" strokeWidth="2" />
      <circle cx="185" cy="90" r="25" fill="none" stroke="#f59e0b" strokeWidth="2" />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * i) / 4
        return (
          <line
            key={`s${i}`}
            x1={(185 + 25 * Math.cos(angle)).toFixed(1)}
            y1={(90 + 25 * Math.sin(angle)).toFixed(1)}
            x2={(185 + 50 * Math.cos(angle)).toFixed(1)}
            y2={(90 + 50 * Math.sin(angle)).toFixed(1)}
            stroke="#f59e0b"
            strokeWidth="2"
          />
        )
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * i) / 4
        return (
          <circle
            key={`sv${i}`}
            cx={(185 + 50 * Math.cos(angle)).toFixed(1)}
            cy={(90 + 50 * Math.sin(angle)).toFixed(1)}
            r="4"
            fill="#f59e0b"
          />
        )
      })}
      <text x="185" y="170" fontSize="11" fill="#b45309" textAnchor="middle">8÷2=4笔</text>

      {/* ── Figure 3: Row of 3 house shapes ── */}
      {[0, 1, 2].map((i) => {
        const bx = 278 + i * 28 - 28
        const by = 115
        const bw = 24
        const bh = 30
        const rx = bx + bw / 2
        const ry = by - 18
        return (
          <g key={`h${i}`}>
            {/* House body */}
            <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke="#f59e0b" strokeWidth="1.8" />
            {/* Roof */}
            <line x1={bx} y1={by} x2={rx} y2={ry} stroke="#f59e0b" strokeWidth="1.8" />
            <line x1={bx + bw} y1={by} x2={rx} y2={ry} stroke="#f59e0b" strokeWidth="1.8" />
          </g>
        )
      })}
      {/* Top arch connecting the three houses */}
      <path d="M 266,97 Q 290,75 314,97" fill="none" stroke="#f59e0b" strokeWidth="1.8" />
      <text x="290" y="170" fontSize="11" fill="#b45309" textAnchor="middle">8÷2=4笔</text>
    </svg>
  )
}

export default HomeworkFig4
