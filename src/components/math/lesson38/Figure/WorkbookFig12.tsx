// Street map for 闯关12: postal route minimum circuit
// Grid layout with labeled edge lengths (units: km)
// Top row: 2-1-2; Right column: 1-1; Inner rectangle on right
// Total + repeats = 30 km
function WorkbookFig12() {
  // Main outer grid (3 columns × 2 rows of squares)
  // Scale: 1km = 40px; vertices:
  // (60, 40)─(140,40)─(180,40)─(260,40)
  //    |                           |
  // (60,120)─(140,120)─(180,120)─(260,120)
  //    |         |          |       |
  // (60,200)─(140,200)─(180,200)─(260,200)
  // Inner small rectangle at right: x=180-260, y=120-200

  return (
    <svg viewBox="0 0 330 240" className="h-full w-full">
      {/* Outer boundary */}
      <rect x="60" y="40" width="200" height="160" fill="none" stroke="#ec4899" strokeWidth="2" />
      {/* Top horizontal dividers */}
      <line x1="140" y1="40" x2="140" y2="120" stroke="#ec4899" strokeWidth="2" />
      <line x1="180" y1="40" x2="180" y2="120" stroke="#ec4899" strokeWidth="2" />
      {/* Middle horizontal */}
      <line x1="60" y1="120" x2="260" y2="120" stroke="#ec4899" strokeWidth="2" />
      {/* Bottom inner rectangle */}
      <line x1="140" y1="120" x2="140" y2="200" stroke="#ec4899" strokeWidth="2" />
      <line x1="180" y1="120" x2="180" y2="200" stroke="#ec4899" strokeWidth="2" />

      {/* Edge length labels */}
      {/* Top horizontal segments */}
      <text x="100" y="32" fontSize="12" fill="#9d174d" textAnchor="middle">2</text>
      <text x="160" y="32" fontSize="12" fill="#9d174d" textAnchor="middle">1</text>
      <text x="220" y="32" fontSize="12" fill="#9d174d" textAnchor="middle">2</text>
      {/* Right vertical segments */}
      <text x="272" y="84"  fontSize="12" fill="#9d174d" textAnchor="middle">1</text>
      <text x="272" y="164" fontSize="12" fill="#9d174d" textAnchor="middle">1</text>
      {/* Left vertical */}
      <text x="48" y="84"  fontSize="12" fill="#9d174d" textAnchor="middle">1</text>
      <text x="48" y="164" fontSize="12" fill="#9d174d" textAnchor="middle">1</text>

      {/* Post office circle */}
      <circle cx="178" cy="200" r="12" fill="none" stroke="#ec4899" strokeWidth="2" />
      <text x="178" y="204" fontSize="10" fill="#9d174d" textAnchor="middle">邮局</text>

      {/* Vertex dots */}
      {[
        [60,40],[140,40],[180,40],[260,40],
        [60,120],[140,120],[180,120],[260,120],
        [60,200],[140,200],[260,200],
      ].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="3.5" fill="#ec4899" />
      ))}

      {/* Answer label */}
      <text x="165" y="230" fontSize="11" fill="#9d174d" textAnchor="middle">
        最短路程 = 30 km
      </text>
    </svg>
  )
}

export default WorkbookFig12
