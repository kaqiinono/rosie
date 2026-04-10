// P2 · 判断两个图形能否一笔画，并标出起点终点
// Fig1: 2×2方格+对角线（多奇点，不能一笔画）
// Fig2: 左箭头+矩形（2个奇点，能一笔画，起终点在凹角处）
const stroke = '#d97706'

export default function PretestFig2() {
  return (
    <svg viewBox="0 0 300 130" className="h-full w-full">
      {/* labels */}
      <text x="80"  y="122" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图①</text>
      <text x="218" y="122" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图②</text>

      {/* ── Fig1: 2×2网格 + 对角线 ── */}
      {/* 外框 */}
      <rect x="22" y="10" width="116" height="100" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 中间竖线 */}
      <line x1="80" y1="10"  x2="80" y2="110" stroke={stroke} strokeWidth="2" />
      {/* 中间横线 */}
      <line x1="22" y1="60"  x2="138" y2="60"  stroke={stroke} strokeWidth="2" />
      {/* 对角线（左上格）: 左上→右下 */}
      <line x1="22" y1="10"  x2="80" y2="60"   stroke={stroke} strokeWidth="2" />
      {/* 对角线（左下格）: 左下→右上 */}
      <line x1="22" y1="110" x2="80" y2="60"   stroke={stroke} strokeWidth="2" />
      {/* 对角线（右上格）: 左上→右下 */}
      <line x1="80" y1="10"  x2="138" y2="60"  stroke={stroke} strokeWidth="2" />
      {/* 对角线（右下格）: 左下→右上 */}
      <line x1="80" y1="110" x2="138" y2="60"  stroke={stroke} strokeWidth="2" />

      {/* ── Fig2: 左箭头 + 矩形（可一笔画） ── */}
      {/* 箭头主体（左指） + 矩形尾部 */}
      {/* 矩形尾: (196,38)-(278,38)-(278,92)-(196,92) */}
      <rect x="196" y="38" width="82" height="54" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 箭头三角（左指）: 凹角在 196,50 和 196,80 */}
      <polyline
        points="196,38 160,65 196,92 196,80 214,80 214,50 196,50"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 封闭上方连接线 */}
      <line x1="196" y1="38" x2="196" y2="50" stroke={stroke} strokeWidth="2" />
      <line x1="196" y1="80" x2="196" y2="92" stroke={stroke} strokeWidth="2" />
    </svg>
  )
}
