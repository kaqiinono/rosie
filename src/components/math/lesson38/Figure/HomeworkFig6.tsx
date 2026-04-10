// Rectangular box 5×4×3 cm with A labeled at front-top-left vertex
function HomeworkFig6() {
  // Front face: (50,155) (200,155) (50,65) (200,65)  — width=150~5, height=90~3
  // Back offset: +55, -40  — depth~4
  return (
    <svg viewBox="0 0 290 220" className="h-full w-full">
      {/* Dashed back edges */}
      <line x1="50"  y1="155" x2="105" y2="115" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1="105" y1="115" x2="255" y2="115" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1="105" y1="25"  x2="105" y2="115" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1="105" y1="25"  x2="255" y2="25"  stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4" />

      {/* Front face */}
      <rect x="50" y="65" width="150" height="90" fill="none" stroke="#7c3aed" strokeWidth="2" />

      {/* Top face */}
      <line x1="50"  y1="65"  x2="105" y2="25"  stroke="#7c3aed" strokeWidth="2" />
      <line x1="200" y1="65"  x2="255" y2="25"  stroke="#7c3aed" strokeWidth="2" />
      <line x1="105" y1="25"  x2="255" y2="25"  stroke="#7c3aed" strokeWidth="2" />

      {/* Right face */}
      <line x1="200" y1="155" x2="255" y2="115" stroke="#7c3aed" strokeWidth="2" />
      <line x1="255" y1="115" x2="255" y2="25"  stroke="#7c3aed" strokeWidth="2" />

      {/* A label at front-top-left */}
      <circle cx="50" cy="65" r="3.5" fill="#7c3aed" />
      <text x="28" y="69" fontSize="13" fontWeight="700" fill="#5b21b6">A</text>

      {/* Dimension labels */}
      <text x="125" y="178" fontSize="12" fill="#6d28d9" textAnchor="middle">5 cm</text>
      <text x="28"  y="115" fontSize="12" fill="#6d28d9" textAnchor="middle">3 cm</text>
      <text x="188" y="18"  fontSize="12" fill="#6d28d9" textAnchor="middle">4 cm</text>
    </svg>
  )
}

export default HomeworkFig6
