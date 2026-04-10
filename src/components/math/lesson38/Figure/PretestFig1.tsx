// P1 · 判断三个图形能否一笔画
// Fig1: 交叉矩形（4个奇点，不能）
// Fig2: 双山峰（2个奇点，能）
// Fig3: 圆形分四扇（4个奇点，不能）
const stroke = '#0891b2'

export default function PretestFig1() {
  return (
    <svg viewBox="0 0 300 130" className="h-full w-full">
      {/* labels */}
      <text x="43"  y="122" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图①</text>
      <text x="152" y="122" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图②</text>
      <text x="258" y="122" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图③</text>

      {/* ── Fig1: 交叉重叠矩形 ── */}
      {/* 主大矩形 */}
      <rect x="22" y="20" width="42" height="80" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 右上小矩形（与大矩形右上角重叠）*/}
      <rect x="42" y="8"  width="32" height="30" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 左下小矩形（与大矩形左下角重叠）*/}
      <rect x="10" y="72" width="32" height="30" fill="none" stroke={stroke} strokeWidth="2" />

      {/* ── Fig2: 双山峰（可一笔画） ── */}
      {/* 小山（左）*/}
      <polyline points="108,108 126,62 145,108" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      {/* 大山（右）*/}
      <polyline points="145,108 163,38 180,108" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      {/* 底边 */}
      <line x1="108" y1="108" x2="180" y2="108" stroke={stroke} strokeWidth="2" />

      {/* ── Fig3: 圆+三线分四扇 ── */}
      <circle cx="258" cy="64" r="44" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 三条线从圆心到圆周，创造4个奇点 */}
      <line x1="258" y1="64" x2="258" y2="20"  stroke={stroke} strokeWidth="2" /> {/* 向上 */}
      <line x1="258" y1="64" x2="302" y2="64"  stroke={stroke} strokeWidth="2" /> {/* 向右 */}
      <line x1="258" y1="64" x2="223" y2="96"  stroke={stroke} strokeWidth="2" /> {/* 左下 */}
    </svg>
  )
}
