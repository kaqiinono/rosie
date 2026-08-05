const stroke = '#4f46e5'

/** 光头强 家 → 森林 道路示意图（边权 = 分钟） */
export default function HomeworkFig5() {
  return (
    <svg viewBox="0 0 320 180" className="mx-auto h-auto w-full max-w-md">
      <text x="8" y="165" fontSize="12" fill={stroke} fontWeight="bold">家</text>
      <text x="268" y="28" fontSize="12" fill={stroke} fontWeight="bold">森林</text>
      <circle cx="40" cy="150" r="6" fill={stroke} />
      <circle cx="130" cy="100" r="5" fill="#818cf8" />
      <circle cx="130" cy="150" r="5" fill="#818cf8" />
      <circle cx="210" cy="70" r="5" fill="#818cf8" />
      <circle cx="210" cy="130" r="5" fill="#818cf8" />
      <circle cx="280" cy="40" r="6" fill={stroke} />
      <line x1="46" y1="145" x2="125" y2="105" stroke={stroke} strokeWidth="2" />
      <text x="75" y="115" fontSize="11" fill="#4338ca">4</text>
      <line x1="46" y1="150" x2="125" y2="150" stroke={stroke} strokeWidth="2" />
      <text x="75" y="142" fontSize="11" fill="#4338ca">2</text>
      <line x1="135" y1="100" x2="205" y2="75" stroke={stroke} strokeWidth="2" />
      <text x="160" y="78" fontSize="11" fill="#4338ca">3</text>
      <line x1="135" y1="102" x2="205" y2="128" stroke={stroke} strokeWidth="2" />
      <text x="160" y="122" fontSize="11" fill="#4338ca">5</text>
      <line x1="135" y1="150" x2="205" y2="128" stroke={stroke} strokeWidth="2" />
      <text x="160" y="148" fontSize="11" fill="#4338ca">2</text>
      <line x1="215" y1="72" x2="274" y2="44" stroke={stroke} strokeWidth="2" />
      <text x="235" y="48" fontSize="11" fill="#4338ca">3</text>
      <line x1="215" y1="128" x2="274" y2="44" stroke={stroke} strokeWidth="2" />
      <text x="235" y="92" fontSize="11" fill="#4338ca">4</text>
    </svg>
  )
}
