// Library floor plan: 5 zones A/B/C/D/E with connecting doors
// Layout: A(top-left) C(top-right) E(center) B(bottom-left) D(bottom-right)
// Doors shown as gaps/edges between zones
function HomeworkFig3() {
  // Outer rectangle: (30,20)-(270,180)
  // Inner dividers: vertical at x=150, horizontal at y=100
  // Center room E around (150,100)
  // Diagonal connections to E
  return (
    <svg viewBox="0 0 310 210" className="h-full w-full">
      {/* Outer boundary */}
      <rect x="30" y="20" width="240" height="160" fill="none" stroke="#6d28d9" strokeWidth="2" />

      {/* Vertical center divider (with gaps for doors) */}
      <line x1="150" y1="20" x2="150" y2="68" stroke="#6d28d9" strokeWidth="2" />
      <line x1="150" y1="82" x2="150" y2="118" stroke="#6d28d9" strokeWidth="2" />
      <line x1="150" y1="132" x2="150" y2="180" stroke="#6d28d9" strokeWidth="2" />

      {/* Horizontal center divider (with gaps) */}
      <line x1="30" y1="100" x2="90" y2="100" stroke="#6d28d9" strokeWidth="2" />
      <line x1="105" y1="100" x2="195" y2="100" stroke="#6d28d9" strokeWidth="2" />
      <line x1="210" y1="100" x2="270" y2="100" stroke="#6d28d9" strokeWidth="2" />

      {/* Diagonal: A(top-left center) → E(center) */}
      <line x1="90" y1="60" x2="132" y2="92" stroke="#6d28d9" strokeWidth="2" />
      {/* Diagonal: C(top-right center) → E(center) */}
      <line x1="210" y1="60" x2="168" y2="92" stroke="#6d28d9" strokeWidth="2" />
      {/* Diagonal: B(bottom-left center) → E(center) */}
      <line x1="90" y1="140" x2="132" y2="108" stroke="#6d28d9" strokeWidth="2" />
      {/* Diagonal: D(bottom-right center) → E(center) */}
      <line x1="210" y1="140" x2="168" y2="108" stroke="#6d28d9" strokeWidth="2" />

      {/* Zone labels */}
      <text x="77" y="68" fontSize="16" fontWeight="700" fill="#5b21b6" textAnchor="middle">A</text>
      <text x="223" y="68" fontSize="16" fontWeight="700" fill="#5b21b6" textAnchor="middle">C</text>
      <text x="150" y="102" fontSize="14" fontWeight="700" fill="#5b21b6" textAnchor="middle">E</text>
      <text x="77" y="148" fontSize="16" fontWeight="700" fill="#5b21b6" textAnchor="middle">B</text>
      <text x="223" y="148" fontSize="16" fontWeight="700" fill="#5b21b6" textAnchor="middle">D</text>

      {/* Door dots on outer wall */}
      <circle cx="30" cy="60" r="4" fill="#a78bfa" />
      <text x="8" y="64" fontSize="11" fill="#7c3aed">入</text>
      <circle cx="150" cy="180" r="4" fill="#a78bfa" />
      <text x="140" y="198" fontSize="11" fill="#7c3aed">出</text>
    </svg>
  )
}

export default HomeworkFig3
