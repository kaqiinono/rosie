// P5 · 正方体棱爬行（边长6cm，A出发回A最多爬多少cm）
// 8顶点全为奇点，需跳过4条棱，最多爬 (12-4)×6 = 48cm
const solid = '#0891b2'
const dashed = '#67e8f9'

export default function PretestFig5() {
  return (
    <svg viewBox="0 0 260 210" className="h-full w-full">
      {/* dashed back edges */}
      <line x1="60" y1="180" x2="108" y2="142" stroke={dashed} strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1="108" y1="142" x2="225" y2="142" stroke={dashed} strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1="108" y1="38"  x2="108" y2="142" stroke={dashed} strokeWidth="1.5" strokeDasharray="5,4" />

      {/* solid front face */}
      <rect x="60" y="78" width="118" height="102" fill="none" stroke={solid} strokeWidth="2.2" />

      {/* top face */}
      <line x1="60"  y1="78"  x2="108" y2="38"  stroke={solid} strokeWidth="2.2" />
      <line x1="178" y1="78"  x2="225" y2="38"  stroke={solid} strokeWidth="2.2" />
      <line x1="108" y1="38"  x2="225" y2="38"  stroke={solid} strokeWidth="2.2" />

      {/* right face */}
      <line x1="178" y1="180" x2="225" y2="142" stroke={solid} strokeWidth="2.2" />
      <line x1="225" y1="142" x2="225" y2="38"  stroke={solid} strokeWidth="2.2" />

      {/* A label at front-bottom-left */}
      <circle cx="60" cy="180" r="3" fill={solid} />
      <text x="36" y="184" fontSize="15" fontWeight="700" fill={solid} fontStyle="italic">A</text>

      {/* side length label */}
      <text x="100" y="202" fontSize="11" textAnchor="middle" fill={solid}>边长 6 cm</text>
    </svg>
  )
}
