// ─── SVG figures ──────────────────────────────────────────────────────────────

const CubeFigure = ({ label }: { label?: string }) => {
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
      {/* 新增：A(60, 190) 到 E(110, 150) 的连线 */}
      <line
        x1="60"
        y1="190"
        x2="110"
        y2="150"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
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
      {/* 注意：这里的 G-H 线已经在下面 solid 组里定义过了，保留即可 */}
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

export default CubeFigure
