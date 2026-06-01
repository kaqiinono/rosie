const stroke = '#4f46e5'

/** 课前测4 · 优优 A→B 道路图（边权 = 分钟） */
export default function PretestFig4() {
  return (
    <svg viewBox="0 0 320 180" className="mx-auto h-auto w-full max-w-md">
      <text x="8" y="95" fontSize="12" fill={stroke} fontWeight="bold">A</text>
      <text x="288" y="95" fontSize="12" fill={stroke} fontWeight="bold">B</text>
      <circle cx="40" cy="90" r="6" fill={stroke} />
      <circle cx="120" cy="40" r="5" fill="#818cf8" />
      <circle cx="120" cy="140" r="5" fill="#818cf8" />
      <circle cx="200" cy="90" r="5" fill="#818cf8" />
      <circle cx="280" cy="90" r="6" fill={stroke} />
      <line x1="46" y1="85" x2="115" y2="45" stroke={stroke} strokeWidth="2" />
      <text x="70" y="55" fontSize="11" fill="#4338ca">4</text>
      <line x1="46" y1="95" x2="115" y2="135" stroke={stroke} strokeWidth="2" />
      <text x="70" y="125" fontSize="11" fill="#4338ca">3</text>
      <line x1="125" y1="40" x2="195" y2="85" stroke={stroke} strokeWidth="2" />
      <text x="150" y="52" fontSize="11" fill="#4338ca">2</text>
      <line x1="125" y1="140" x2="195" y2="90" stroke={stroke} strokeWidth="2" />
      <text x="150" y="128" fontSize="11" fill="#4338ca">2</text>
      <line x1="205" y1="90" x2="274" y2="90" stroke={stroke} strokeWidth="2" />
      <text x="230" y="82" fontSize="11" fill="#4338ca">3</text>
    </svg>
  )
}
