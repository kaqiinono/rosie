const stroke = '#4f46e5'

/** 纳纳家 → 游乐场 道路示意图（边权 = 分钟） */
export default function LessonFig6() {
  return (
    <svg viewBox="0 0 320 180" className="mx-auto h-auto w-full max-w-md">
      <text x="8" y="165" fontSize="12" fill={stroke} fontWeight="bold">家</text>
      <text x="268" y="28" fontSize="12" fill={stroke} fontWeight="bold">游乐场</text>
      <circle cx="40" cy="150" r="6" fill={stroke} />
      <circle cx="120" cy="90" r="5" fill="#818cf8" />
      <circle cx="120" cy="150" r="5" fill="#818cf8" />
      <circle cx="200" cy="60" r="5" fill="#818cf8" />
      <circle cx="200" cy="120" r="5" fill="#818cf8" />
      <circle cx="280" cy="40" r="6" fill={stroke} />
      <line x1="46" y1="145" x2="115" y2="95" stroke={stroke} strokeWidth="2" />
      <text x="70" y="110" fontSize="11" fill="#4338ca">3</text>
      <line x1="46" y1="150" x2="115" y2="150" stroke={stroke} strokeWidth="2" />
      <text x="70" y="142" fontSize="11" fill="#4338ca">6</text>
      <line x1="125" y1="90" x2="195" y2="65" stroke={stroke} strokeWidth="2" />
      <text x="150" y="68" fontSize="11" fill="#4338ca">2</text>
      <line x1="125" y1="92" x2="195" y2="118" stroke={stroke} strokeWidth="2" />
      <text x="150" y="112" fontSize="11" fill="#4338ca">4</text>
      <line x1="125" y1="150" x2="195" y2="122" stroke={stroke} strokeWidth="2" />
      <text x="150" y="142" fontSize="11" fill="#4338ca">1</text>
      <line x1="205" y1="62" x2="274" y2="44" stroke={stroke} strokeWidth="2" />
      <text x="230" y="44" fontSize="11" fill="#4338ca">4</text>
      <line x1="205" y1="118" x2="274" y2="44" stroke={stroke} strokeWidth="2" />
      <text x="230" y="88" fontSize="11" fill="#4338ca">2</text>
    </svg>
  )
}
