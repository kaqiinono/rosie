// P3 · 观察各图，每个图形最少需要几笔画出
// Fig1: 2格（1条分隔线，2个奇点） → 1笔
// Fig2: 3格（2条分隔线，4个奇点） → 2笔
// Fig3: 带内角矩形（竖线+横线，4个奇点）→ 2笔
const stroke = '#0891b2'

export default function PretestFig3() {
  return (
    <svg viewBox="0 0 340 100" className="h-full w-full">
      {/* labels */}
      <text x="50"  y="92" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图①</text>
      <text x="163" y="92" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图②</text>
      <text x="285" y="92" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图③</text>

      {/* ── Fig1: 2格矩形 ── */}
      <rect x="8"  y="8" width="84" height="72" fill="none" stroke={stroke} strokeWidth="2" />
      <line x1="50" y1="8" x2="50" y2="80" stroke={stroke} strokeWidth="2" />

      {/* ── Fig2: 3格矩形 ── */}
      <rect x="106" y="8" width="114" height="72" fill="none" stroke={stroke} strokeWidth="2" />
      <line x1="144" y1="8" x2="144" y2="80" stroke={stroke} strokeWidth="2" />
      <line x1="182" y1="8" x2="182" y2="80" stroke={stroke} strokeWidth="2" />

      {/* ── Fig3: 带内角矩形（右侧有分隔格）── */}
      {/* 外大矩形 */}
      <rect x="236" y="8" width="96" height="72" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 竖向分隔线（将右侧划出小列）*/}
      <line x1="298" y1="8" x2="298" y2="80" stroke={stroke} strokeWidth="2" />
      {/* 横向分隔线（在右下角创造小格）*/}
      <line x1="298" y1="46" x2="332" y2="46" stroke={stroke} strokeWidth="2" />
    </svg>
  )
}
