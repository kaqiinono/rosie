const stroke = '#4f46e5'

/** 小纳 家 → 学校 道路图（边权 = 分钟） */
export default function WorkbookFig9() {
  return (
    <svg viewBox="0 0 320 180" className="mx-auto h-auto w-full max-w-md">
      <text x="8" y="95" fontSize="12" fill={stroke} fontWeight="bold">家</text>
      <text x="278" y="95" fontSize="12" fill={stroke} fontWeight="bold">学校</text>
      <circle cx="40" cy="90" r="6" fill={stroke} />
      <circle cx="110" cy="40" r="5" fill="#818cf8" />
      <circle cx="110" cy="140" r="5" fill="#818cf8" />
      <circle cx="190" cy="90" r="5" fill="#818cf8" />
      <circle cx="280" cy="90" r="6" fill={stroke} />
      <line x1="46" y1="85" x2="105" y2="45" stroke={stroke} strokeWidth="2" />
      <text x="65" y="55" fontSize="11" fill="#4338ca">5</text>
      <line x1="46" y1="95" x2="105" y2="135" stroke={stroke} strokeWidth="2" />
      <text x="65" y="125" fontSize="11" fill="#4338ca">3</text>
      <line x1="115" y1="40" x2="185" y2="85" stroke={stroke} strokeWidth="2" />
      <text x="140" y="52" fontSize="11" fill="#4338ca">2</text>
      <line x1="115" y1="140" x2="185" y2="95" stroke={stroke} strokeWidth="2" />
      <text x="140" y="128" fontSize="11" fill="#4338ca">4</text>
      <line x1="115" y1="140" x2="274" y2="95" stroke={stroke} strokeWidth="2" strokeDasharray="4 3" />
      <text x="185" y="128" fontSize="11" fill="#4338ca">6</text>
      <line x1="195" y1="90" x2="274" y2="90" stroke={stroke} strokeWidth="2" />
      <text x="225" y="82" fontSize="11" fill="#4338ca">1</text>
    </svg>
  )
}
