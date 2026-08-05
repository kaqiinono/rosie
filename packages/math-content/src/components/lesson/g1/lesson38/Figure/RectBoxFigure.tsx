function RectBoxFigure() {
  // A-labeled cuboid, slightly wider
  // front: (70,160) (200,160) (70,70) (200,70)
  // back offset +45,-35
  return (
    <svg viewBox="0 0 280 210" className="h-full w-full">
      {/* dashed back (后方虚线组) */}
      {/* 补全：左下前角(70, 160) 到 左下后角(115, 125) */}
      <line
        x1="70"
        y1="160"
        x2="115"
        y2="125"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="115"
        y1="125"
        x2="245"
        y2="125"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="115"
        y1="35"
        x2="115"
        y2="125"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />
      <line
        x1="115"
        y1="35"
        x2="245"
        y2="35"
        stroke="#f9a8d4"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />

      {/* front face (前表面) */}
      <rect x="70" y="70" width="130" height="90" fill="none" stroke="#ec4899" strokeWidth="2" />

      {/* top (顶面实线) */}
      <line x1="70" y1="70" x2="115" y2="35" stroke="#ec4899" strokeWidth="2" />
      <line x1="200" y1="70" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />
      <line x1="115" y1="35" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />

      {/* right (右侧面实线) */}
      <line x1="200" y1="160" x2="245" y2="125" stroke="#ec4899" strokeWidth="2" />
      <line x1="245" y1="125" x2="245" y2="35" stroke="#ec4899" strokeWidth="2" />

      {/* A label at front-top-left */}
      <circle cx="70" cy="70" r="3.5" fill="#ec4899" />
      <text x="48" y="72" fontSize="13" fontWeight="700" fill="#be185d">
        A
      </text>
    </svg>
  )
}

export default RectBoxFigure
