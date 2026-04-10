// 六面体 (hexahedron) for 例题2
// Vertices: D(top/dest), A(left), B(center/ant-B), C(right), E(bottom/ant-E)
// Edges: 9 total → 2 odd vertices (D,E), 3 even vertices (A,B,C)
function LessonFig2() {
  const pts = {
    D: { x: 155, y: 28 },
    A: { x: 65,  y: 105 },
    B: { x: 155, y: 145 },
    C: { x: 245, y: 105 },
    E: { x: 155, y: 205 },
  }
  const edges: [keyof typeof pts, keyof typeof pts][] = [
    ['D','A'], ['D','B'], ['D','C'],
    ['A','B'], ['A','C'], ['A','E'],
    ['B','C'], ['B','E'], ['C','E'],
  ]
  return (
    <svg viewBox="0 0 310 240" className="h-full w-full">
      {/* Edges */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a].x} y1={pts[a].y}
          x2={pts[b].x} y2={pts[b].y}
          stroke="#0ea5e9" strokeWidth="2"
        />
      ))}
      {/* Vertex dots */}
      {(Object.keys(pts) as (keyof typeof pts)[]).map((k) => (
        <circle key={k} cx={pts[k].x} cy={pts[k].y} r={5}
          fill={k === 'B' || k === 'E' ? '#f97316' : '#0ea5e9'} />
      ))}
      {/* Labels */}
      <text x={pts.D.x + 8}  y={pts.D.y - 4}  fontSize="14" fontWeight="700" fill="#0284c7">D ★</text>
      <text x={pts.A.x - 22} y={pts.A.y + 5}  fontSize="14" fontWeight="700" fill="#0284c7">A</text>
      <text x={pts.B.x + 8}  y={pts.B.y + 5}  fontSize="14" fontWeight="700" fill="#c2410c">B●</text>
      <text x={pts.C.x + 8}  y={pts.C.y + 5}  fontSize="14" fontWeight="700" fill="#0284c7">C</text>
      <text x={pts.E.x + 8}  y={pts.E.y + 5}  fontSize="14" fontWeight="700" fill="#c2410c">E●</text>
    </svg>
  )
}

export default LessonFig2
