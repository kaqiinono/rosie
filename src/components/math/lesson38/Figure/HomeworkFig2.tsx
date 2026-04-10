// Garden watering path: rectangle with X diagonals, labeled A (right), B (bottom), C (top-left)
function HomeworkFig2() {
  // Rectangle: (40,30) - (280,160), center (160,95)
  // Diagonals cross at center
  const x1 = 40, y1 = 30, x2 = 280, y2 = 160
  const cx = (x1 + x2) / 2 // 160
  const cy = (y1 + y2) / 2 // 95
  return (
    <svg viewBox="0 0 330 200" className="h-full w-full">
      {/* Rectangle */}
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke="#f59e0b" strokeWidth="2" />
      {/* Diagonal 1: top-left to bottom-right */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="2" />
      {/* Diagonal 2: top-right to bottom-left */}
      <line x1={x2} y1={y1} x2={x1} y2={y2} stroke="#f59e0b" strokeWidth="2" />

      {/* Vertices (dots) */}
      {/* C = top-left */}
      <circle cx={x1} cy={y1} r={4} fill="#f59e0b" />
      <text x={x1 - 18} y={y1 + 5} fontSize="14" fontWeight="700" fill="#b45309">C</text>
      {/* top-right */}
      <circle cx={x2} cy={y1} r={4} fill="#f59e0b" />
      {/* A = right-side (treating top-right as A from PDF) */}
      <text x={x2 + 6} y={y1 + 5} fontSize="14" fontWeight="700" fill="#b45309">A</text>
      {/* bottom-left */}
      <circle cx={x1} cy={y2} r={4} fill="#f59e0b" />
      {/* B = bottom (treating bottom-left as B from PDF) */}
      <text x={x1 - 6} y={y2 + 18} fontSize="14" fontWeight="700" fill="#b45309">B</text>
      {/* bottom-right */}
      <circle cx={x2} cy={y2} r={4} fill="#f59e0b" />
      {/* Center crossing */}
      <circle cx={cx} cy={cy} r={4} fill="#f59e0b" />
    </svg>
  )
}

export default HomeworkFig2
