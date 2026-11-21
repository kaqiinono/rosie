export default function WiltBin({ count }: { count: number }) {
  const badgeWidth = 16 + String(count).length * 8
  return (
    <svg aria-hidden="true" focusable="false" width="100%" height="100%"
      viewBox="-2 -10 124 73" preserveAspectRatio="xMinYMax meet">
      <path d="M2 17 L12 3 Q13 1 17 1 H95 Q99 1 100 3 L110 17Z" fill="#659688" stroke="#43776b" strokeWidth="2.5" />
      <path d="M23 19 L21 0 Q21 -3 24 -3 L45 -5 Q48 -5 48 -2 L51 19Z" fill="#ffe59b" stroke="#c2994f" strokeWidth="2" />
      <path d="M4 17 H108 L103 52 Q102 60 94 60 H18 Q10 60 9 52Z" fill="#a6ddc5" stroke="#43776b" strokeWidth="2.5" />
      <rect x="1" y="13" width="110" height="9" rx="4" fill="#d3eedc" stroke="#43776b" strokeWidth="2.5" />
      <rect x="18" y="26" width="76" height="28" rx="8" fill="#fff0df" />
      <text x="56" y="47" textAnchor="middle" fontSize="20" fontWeight="700" fill="#99345a">枯萎箱</text>
      {count > 0 && (
        <g>
          <rect x={120 - badgeWidth} y="-8" width={badgeWidth} height="22" rx="11" fill="#99345a" stroke="#fff0df" strokeWidth="2" />
          <text x={120 - badgeWidth / 2} y="7" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{count}</text>
        </g>
      )}
    </svg>
  )
}
