// P4 · 添加或去掉一条线使图形能一笔画
// Fig1: 三角形+内部线段（4个奇点，添/删1条线→能）
// Fig2: 圆形+交叉线（4个奇点，添/删1条线→能）
const stroke = '#d97706'

export default function PretestFig4() {
  return (
    <svg viewBox="0 0 300 150" className="h-full w-full">
      {/* labels */}
      <text x="80"  y="142" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图①</text>
      <text x="218" y="142" fontSize="10" textAnchor="middle" fill={stroke} fontWeight="600">图②</text>

      {/* ── Fig1: 三角形 + 内部辅助线 ── */}
      {/* 外大三角形 */}
      <polygon points="80,12 10,128 150,128" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      {/* 内部：从底边延伸出的垂线到顶点（高线）*/}
      <line x1="80" y1="12" x2="80" y2="128" stroke={stroke} strokeWidth="2" />
      {/* 内部：底边上中部到左侧斜边中点 */}
      <line x1="45" y1="70" x2="80" y2="128" stroke={stroke} strokeWidth="2" />

      {/* ── Fig2: 圆 + 十字 + 对角线（8奇点星形）── */}
      <circle cx="218" cy="72" r="52" fill="none" stroke={stroke} strokeWidth="2" />
      {/* 水平直径 */}
      <line x1="166" y1="72" x2="270" y2="72" stroke={stroke} strokeWidth="2" />
      {/* 竖直直径 */}
      <line x1="218" y1="20" x2="218" y2="124" stroke={stroke} strokeWidth="2" />
      {/* 左斜对角 */}
      <line x1="181" y1="35" x2="255" y2="109" stroke={stroke} strokeWidth="2" />
      {/* 右斜对角 */}
      <line x1="255" y1="35" x2="181" y2="109" stroke={stroke} strokeWidth="2" />
    </svg>
  )
}
