// Circular road network for 例题6: wheel-like graph with labeled edge lengths
// Outer ring: 3 arcs of 4km; inner ring: 3 arcs of 2km; center spoke: 1km
// Total = 4+4+4+2+2+2+1 = 19km; 6 odd vertices
function LessonFig6() {
  const cx = 155, cy = 115
  const R = 80, r = 42

  // 6 outer vertices at 60° intervals (starting from top)
  const outer = Array.from({ length: 6 }, (_, i) => ({
    x: cx + R * Math.sin((2 * Math.PI * i) / 6),
    y: cy - R * Math.cos((2 * Math.PI * i) / 6),
  }))
  // 6 inner vertices at same angles
  const inner = Array.from({ length: 6 }, (_, i) => ({
    x: cx + r * Math.sin((2 * Math.PI * i) / 6),
    y: cy - r * Math.cos((2 * Math.PI * i) / 6),
  }))

  // Edge labels for outer arcs (4km) and inner arcs (2km)
  // Midpoint between consecutive vertices for label placement
  const midAngle = (i: number, n: number) => ((2 * Math.PI * (i + 0.5)) / n)

  return (
    <svg viewBox="0 0 310 240" className="h-full w-full">
      {/* Outer circle arcs (6 edges of alternating 4km) */}
      {outer.map((p, i) => {
        const next = outer[(i + 1) % 6]
        const ma = midAngle(i, 6)
        const mx = cx + (R + 16) * Math.sin(ma)
        const my = cy - (R + 16) * Math.cos(ma)
        return (
          <g key={`out${i}`}>
            <line x1={p.x.toFixed(1)} y1={p.y.toFixed(1)}
                  x2={next.x.toFixed(1)} y2={next.y.toFixed(1)}
                  stroke="#f59e0b" strokeWidth="2" />
            <text x={mx.toFixed(1)} y={my.toFixed(1)} fontSize="11"
                  fill="#b45309" textAnchor="middle" dominantBaseline="middle">4</text>
          </g>
        )
      })}
      {/* Inner ring arcs (6 edges of alternating 2km) */}
      {inner.map((p, i) => {
        const next = inner[(i + 1) % 6]
        const ma = midAngle(i, 6)
        const mx = cx + (r + 14) * Math.sin(ma)
        const my = cy - (r + 14) * Math.cos(ma)
        return (
          <g key={`in${i}`}>
            <line x1={p.x.toFixed(1)} y1={p.y.toFixed(1)}
                  x2={next.x.toFixed(1)} y2={next.y.toFixed(1)}
                  stroke="#f59e0b" strokeWidth="2" />
            <text x={mx.toFixed(1)} y={my.toFixed(1)} fontSize="11"
                  fill="#b45309" textAnchor="middle" dominantBaseline="middle">2</text>
          </g>
        )
      })}
      {/* Spokes: outer to inner (every other, 3 spokes) */}
      {[0, 2, 4].map((i) => (
        <line key={`sp${i}`}
          x1={outer[i].x.toFixed(1)} y1={outer[i].y.toFixed(1)}
          x2={inner[i].x.toFixed(1)} y2={inner[i].y.toFixed(1)}
          stroke="#f59e0b" strokeWidth="2" />
      ))}
      {/* Center to one inner vertex (1km) */}
      <line x1={cx} y1={cy} x2={inner[1].x.toFixed(1)} y2={inner[1].y.toFixed(1)}
            stroke="#f59e0b" strokeWidth="2" />
      <text x={(cx + inner[1].x) / 2 + 8} y={(cy + inner[1].y) / 2}
            fontSize="11" fill="#b45309" textAnchor="middle">1</text>

      {/* Vertex dots */}
      {outer.map((p, i) => (
        <circle key={`ov${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill="#f59e0b" />
      ))}
      {inner.map((p, i) => (
        <circle key={`iv${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill="#f59e0b" />
      ))}
      <circle cx={cx} cy={cy} r="4" fill="#f59e0b" />

      {/* Total label */}
      <text x={cx} y={225} fontSize="12" fill="#92400e" textAnchor="middle">
        总长：4×3+2×3+1 = 19 km
      </text>
    </svg>
  )
}

export default LessonFig6
