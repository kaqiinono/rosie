// Three figures for homework 1: judge which can be drawn in one stroke
// Figure 1 (Saturn-like): ✗ | Figure 2 (linked loops): ✗ | Figure 3 (diamond+rect): ✓
function HomeworkFig1() {
  return (
    <svg viewBox="0 0 360 160" className="h-full w-full">
      {/* ── Figure 1: Saturn-like shape (NOT one-stroke) ── */}
      {/* Planet body */}
      <ellipse cx="65" cy="85" rx="38" ry="28" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Ring (tilted ellipse) */}
      <ellipse
        cx="65"
        cy="85"
        rx="54"
        ry="18"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        transform="rotate(-15 65 85)"
      />
      {/* Small circle attached left */}
      <circle cx="18" cy="85" r="12" fill="none" stroke="#0ea5e9" strokeWidth="2" />

      {/* ── Figure 2: Two loops connected by crossing edges (NOT one-stroke) ── */}
      {/* Left circle */}
      <circle cx="165" cy="85" r="28" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Right circle */}
      <circle cx="223" cy="85" r="28" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Top connector dot + line */}
      <circle cx="178" cy="62" r="4" fill="#0ea5e9" />
      <circle cx="210" cy="62" r="4" fill="#0ea5e9" />
      <line x1="178" y1="62" x2="210" y2="62" stroke="#0ea5e9" strokeWidth="2" />
      {/* Bottom connector dot + line */}
      <circle cx="178" cy="108" r="4" fill="#0ea5e9" />
      <circle cx="210" cy="108" r="4" fill="#0ea5e9" />
      <line x1="178" y1="108" x2="210" y2="108" stroke="#0ea5e9" strokeWidth="2" />

      {/* ── Figure 3: Rectangle + inscribed diamond sharing midpoints (CAN one-stroke) ── */}
      {/* Rectangle */}
      <rect x="272" y="50" width="70" height="70" fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {/* Diamond (corners at midpoints of rectangle edges) */}
      <polygon
        points="307,50 342,85 307,120 272,85"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
      />
    </svg>
  )
}

export default HomeworkFig1
