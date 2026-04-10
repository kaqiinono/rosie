// Two figures that cannot be one-stroke; modify by adding/removing one line
// Fig1: Rectangle + X inside (4 odd vertices → remove 1 line to fix)
// Fig2: Three tangent circles with connecting edge (modify to fix)
function HomeworkFig5() {
  return (
    <svg viewBox="0 0 340 180" className="h-full w-full">
      {/* ── Figure 1: Rectangle with X inside (4 odd vertices) ── */}
      {/* Outer rectangle */}
      <rect x="20" y="30" width="130" height="120" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Inner rectangle (shifted left for X pattern like PDF) */}
      <rect x="50" y="55" width="70" height="70" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* X diagonals of inner rect */}
      <line x1="50" y1="55" x2="120" y2="125" stroke="#0ea5e9" strokeWidth="2" />
      <line x1="120" y1="55" x2="50" y2="125" stroke="#0ea5e9" strokeWidth="2" />
      {/* Vertex dots at X intersection */}
      <circle cx="85" cy="90" r="4" fill="#0ea5e9" />
      <circle cx="50" cy="55" r="4" fill="#0ea5e9" />
      <circle cx="120" cy="55" r="4" fill="#0ea5e9" />
      <circle cx="50" cy="125" r="4" fill="#0ea5e9" />
      <circle cx="120" cy="125" r="4" fill="#0ea5e9" />
      <text x="85" y="170" fontSize="11" fill="#0369a1" textAnchor="middle">添加一条线可一笔画</text>

      {/* ── Figure 2: Three circles with connecting bridge ── */}
      {/* Left circle */}
      <circle cx="220" cy="85" r="35" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Middle circle */}
      <circle cx="270" cy="85" r="35" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Right circle */}
      <circle cx="320" cy="85" r="35" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Vertical connector between middle circles (the "bridge" that creates odd vertices) */}
      <line x1="270" y1="50" x2="270" y2="120" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,3" />
      {/* Dots at key vertices */}
      <circle cx="245" cy="85" r="4" fill="#0ea5e9" />
      <circle cx="295" cy="85" r="4" fill="#0ea5e9" />
      <circle cx="270" cy="50" r="4" fill="#0ea5e9" />
      <circle cx="270" cy="120" r="4" fill="#0ea5e9" />
      <text x="270" y="170" fontSize="11" fill="#0369a1" textAnchor="middle">去掉一条线可一笔画</text>
    </svg>
  )
}

export default HomeworkFig5
