// Street map for problem 5 (grid with labeled distances)
function StreetMapFigure() {
  // 1 row × 5 columns of blocks
  // horizontal segment widths: 3, 4, 2, 1, 4 (km)
  // vertical height: 5 (km)
  const scale = 30
  const xs = [40, 40 + 3 * scale, 40 + 7 * scale, 40 + 9 * scale, 40 + 10 * scale, 40 + 14 * scale]
  const y0 = 30,
    y1 = 30 + 5 * scale
  const widths = [3, 4, 2, 1, 4]

  return (
    <svg viewBox="0 0 520 230" className="h-full w-full">
      {/* vertical lines */}
      {xs.map((x, i) => (
        <line key={i} x1={x} y1={y0} x2={x} y2={y1} stroke="#16a34a" strokeWidth="2" />
      ))}
      {/* horizontal top and bottom */}
      <line x1={xs[0]} y1={y0} x2={xs[5]} y2={y0} stroke="#16a34a" strokeWidth="2" />
      <line x1={xs[0]} y1={y1} x2={xs[5]} y2={y1} stroke="#16a34a" strokeWidth="2" />

      {/* top distance labels */}
      {widths.map((w, i) => (
        <text
          key={i}
          x={(xs[i] + xs[i + 1]) / 2}
          y={y0 - 8}
          fontSize="13"
          fontWeight="700"
          fill="#15803d"
          textAnchor="middle"
        >
          {w}
        </text>
      ))}
      {/* left height label */}
      <text
        x={xs[0] - 18}
        y={(y0 + y1) / 2 + 5}
        fontSize="13"
        fontWeight="700"
        fill="#15803d"
        textAnchor="middle"
      >
        5
      </text>

      {/* starting point marker */}
      <circle cx={xs[0]} cy={y1} r="5" fill="#15803d" />
      <text x={xs[0]} y={y1 + 20} fontSize="12" fill="#15803d" fontWeight="600" textAnchor="middle">
        起点
      </text>
    </svg>
  )
}

export default StreetMapFigure
