import React, { useState, useCallback, useId } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
export interface WeekdayFlowChartProps {
  /** 开始日期，格式 'YYYY-MM-DD' */
  startDate: string
  /** 结束日期，格式 'YYYY-MM-DD' */
  endDate: string
  /**
   * 开始日期对应的星期数（蓝色方框内容）
   * 1=周一 2=周二 3=周三 4=周四 5=周五 6=周六 7=周日
   */
  startWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

// ── Constants ──────────────────────────────────────────────────────────────
const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

// SVG viewBox layout constants
const V = {
  W: 780,
  H: 320,
  // Total-days red input center (on timeline)
  tdCX: 390,
  tdY: 55,
  // Division row y-center
  dY: 185,
  // Red box "经过多少天"
  rbX: 162, rbY: 166, rbW: 120, rbH: 38,
  // Quotient yellow area center-x
  qCX: 365,
  // Remainder yellow area center-x
  rCX: 495,
  // Pill positions
  spCX: 75,   // start weekday pill
  qpCX: 365,  // quotient weekday pill
  rpCX: 495,  // remainder weekday pill
  epCX: 705,  // end weekday pill
}

// ── Helpers ────────────────────────────────────────────────────────────────
function calcDays(start: string, end: string): number | null {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return diff >= 0 ? Math.round(diff / 86400000) : null
}

function fmtDate(d: string): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${y}年${m}月${day}日`
}

function svgPct(px: number, dim: 'x' | 'y'): string {
  return ((px / (dim === 'x' ? V.W : V.H)) * 100).toFixed(3) + '%'
}

// ── Sub-components (SVG helpers) ───────────────────────────────────────────
const FONT = "'PingFang SC','Microsoft YaHei',sans-serif"

interface PillProps {
  cx: number; cy: number; label: string; color: 'blue' | 'red'
}
const Pill: React.FC<PillProps> = ({ cx, cy, label, color }) => {
  const fill   = color === 'blue' ? '#d6e8f7' : '#fee2e2'
  const stroke = color === 'blue' ? '#6b9fd4' : '#e88a8a'
  const tc     = color === 'blue' ? '#1a4a7c' : '#7c1a1a'
  const w = 60, h = 28, rx = 14
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={rx}
        fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fontSize={14} fontWeight={700} fill={tc} fontFamily={FONT}>
        {label}
      </text>
    </g>
  )
}

interface KnownBoxProps {
  x: number; y: number; w: number; h: number; line1: string; line2: string
}
const KnownBox: React.FC<KnownBoxProps> = ({ x, y, w, h, line1, line2 }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={10}
      fill="#d6e8f7" stroke="#6b9fd4" strokeWidth={1.5} />
    <text x={x + w / 2} y={y + h / 2 - 8} textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={700} fill="#1a4a7c" fontFamily={FONT}>
      {line1}
    </text>
    <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" dominantBaseline="central"
      fontSize={11} fill="#4a7cb5" fontFamily={FONT}>
      {line2}
    </text>
  </g>
)

// ── Main Component ─────────────────────────────────────────────────────────
const Days: React.FC<WeekdayFlowChartProps> = ({
  startDate,
  endDate,
  startWeekday,
}) => {
  const uid = useId().replace(/:/g, '')

  // User input state
  const [total, setTotal] = useState('')
  const [q, setQ]         = useState('')
  const [r, setR]         = useState('')
  const [ew, setEw]       = useState('')

  // Derived values
  const autoTotal = calcDays(startDate, endDate)
  const swLabel   = WD[startWeekday]
  const ewLabel   = ew && +ew >= 1 && +ew <= 7 ? WD[+ew as 1|2|3|4|5|6|7] : '周?'

  // Validation
  const totalOk = total !== '' && autoTotal !== null && +total === autoTotal
  const divOk   = total !== '' && q !== '' && r !== '' && +q * 7 + +r === +total
  const compEW  = startWeekday && r !== '' ? ((startWeekday - 1 + +r) % 7) + 1 : null
  const ewOk    = compEW !== null && ew !== '' && +ew === compEW
  const allOk   = totalOk && divOk && ewOk

  const handleReset = useCallback(() => {
    setTotal(''); setQ(''); setR(''); setEw('')
  }, [])

  // Status bar content
  let statusMsg = '请依次填入红色和黄色框中的数值…'
  let statusClass = 'bg-slate-100 text-slate-500 border border-slate-200'
  if (allOk) {
    statusMsg = `🎉 完全正确！结束日期是 ${WD[compEW as number]}`
    statusClass = 'bg-green-50 text-green-800 border border-green-300'
  } else {
    const hints: string[] = []
    if (total !== '' && !totalOk && autoTotal !== null) hints.push(`经过天数应为 ${autoTotal}`)
    if (total !== '' && q !== '' && r !== '' && !divOk) hints.push(`${total}÷7 不正确`)
    if (compEW && ew !== '' && !ewOk) hints.push(`结束星期应为 ${WD[compEW]}`)
    if (hints.length) statusMsg = '✗ ' + hints.join('；')
  }

  // Marker ids (scoped to avoid collision with multiple instances)
  const mAB  = `ab-${uid}`
  const mAR  = `ar-${uid}`
  const mAR2 = `ar2-${uid}`
  const mAT  = `at-${uid}`

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* ── Chart Card ── */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-md px-6 py-8">
        {/* SVG + overlay wrapper */}
        <div className="relative w-full">
          {/* ── SVG ── */}
          <svg
            width="100%"
            viewBox={`0 0 ${V.W} ${V.H}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible', display: 'block' }}
          >
            <defs>
              {/* Blue arrowhead */}
              <marker id={mAB} viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M2 2L8 5L2 8" fill="none" stroke="#6b9fd4"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  transform="rotate(15 8 5)" />
              </marker>
              {/* Red arrowhead 1 */}
              <marker id={mAR} viewBox="0 0 10 10" refX="10" refY="5"
                markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M2 2L8 5L2 10" fill="none" stroke="#e88a8a"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  transform="rotate(40 8 5)" />
              </marker>
              {/* Red arrowhead 2 */}
              <marker id={mAR2} viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M2 2L8 5L2 10" fill="none" stroke="#e88a8a"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  transform="rotate(10 8 5)" />
              </marker>
              {/* Black arrowhead (timeline) */}
              <marker id={mAT} viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M1 1L9 5L1 9" fill="none" stroke="#1e293b"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {/* ── Timeline arrow ── */}
            <line x1="140" y1="79" x2="640" y2="79"
              stroke="#1e293b" strokeWidth={2} markerEnd={`url(#${mAT})`} />

            {/* ── Start / End known boxes ── */}
            <KnownBox x={10} y={55} w={130} h={48}
              line1={fmtDate(startDate)} line2="开始日期" />
            <KnownBox x={640} y={55} w={130} h={48}
              line1={fmtDate(endDate)} line2="结束日期" />

            {/* ── Division row ── */}
            {/* "经过多少天" red box */}
            <rect x={V.rbX} y={V.rbY} width={V.rbW} height={V.rbH} rx={9}
              fill="#fee2e2" stroke="#e88a8a" strokeWidth={1.5} />
            <text x={V.rbX + V.rbW / 2} y={V.rbY + V.rbH / 2}
              textAnchor="middle" dominantBaseline="central"
              fontSize={13} fontWeight={600} fill="#7c1a1a" fontFamily={FONT}>
              经过多少天
            </text>

            {/* ÷ 7 = */}
            <text x={310} y={185} textAnchor="middle" dominantBaseline="central"
              fontSize={20} fontWeight={700} fill="#1e293b" fontFamily={FONT}>
              ÷ 7 =
            </text>

            {/* Quotient underline */}
            <line x1={333} y1={205} x2={397} y2={205}
              stroke="#1e293b" strokeWidth={1.5} />

            {/* 周 label */}
            <text x={405} y={185} textAnchor="start" dominantBaseline="central"
              fontSize={20} fontWeight={700} fill="#1e293b" fontFamily={FONT}>
              周
            </text>

            {/* …… */}
            <text x={447} y={185} textAnchor="middle" dominantBaseline="central"
              fontSize={18} fill="#555" fontFamily={FONT}>
              ……
            </text>

            {/* Remainder underline */}
            <line x1={463} y1={205} x2={527} y2={205}
              stroke="#1e293b" strokeWidth={1.5} />

            {/* 天 label */}
            <text x={535} y={185} textAnchor="start" dominantBaseline="central"
              fontSize={20} fontWeight={700} fill="#1e293b" fontFamily={FONT}>
              天
            </text>

            {/* ── Pill row ── */}
            {/* Start weekday pill (blue, known) */}
            <Pill cx={V.spCX} cy={125} label={swLabel} color="blue" />

            {/* Quotient weekday pill (blue, same as start) */}
            <Pill cx={V.qpCX} cy={224} label={swLabel} color="blue" />

            {/* End weekday pill (red, unknown) */}
            <Pill cx={V.rpCX} cy={224} label={ewLabel} color="red" />

            {/* ── Dashed arrows ── */}
            {/* Blue: start pill → quotient pill */}
            <path d="M 70 142 C 75 278, 365 308, 365 240"
              fill="none" stroke="#6b9fd4" strokeWidth={2}
              strokeDasharray="7 5" markerEnd={`url(#${mAB})`} />

            {/* Red: total days → red box */}
            <path d="M 390 73 C 390 100, 232 136, 232 166"
              fill="none" stroke="#e88a8a" strokeWidth={2}
              strokeDasharray="7 5" markerEnd={`url(#${mAR})`} />

            {/* Red: remainder pill → end block */}
            <path d="M 495 242 C 495 308, 705 308, 705 144"
              fill="none" stroke="#e88a8a" strokeWidth={2}
              strokeDasharray="7 5" markerEnd={`url(#${mAR2})`} />

            {/* ── "经过" label on timeline ── */}
            <text x={334} y={63} textAnchor="middle" dominantBaseline="auto"
              fontSize={14} fill="#555" fontFamily={FONT}>
              经过
            </text>
            <text x={442} y={63} textAnchor="middle" dominantBaseline="auto"
              fontSize={14} fill="#555" fontFamily={FONT}>
              天
            </text>
          </svg>

          {/* ── Absolute-positioned input overlays ── */}

          {/* Total days (red) — on timeline center */}
          <InputOverlay
            left={svgPct(V.tdCX, 'x')}
            top={svgPct(V.tdY, 'y')}
            value={total}
            onChange={setTotal}
            placeholder="?"
            variant="red"
          />

          {/* Quotient (yellow) */}
          <InputOverlay
            left={svgPct(V.qCX, 'x')}
            top={svgPct(V.dY, 'y')}
            value={q}
            onChange={setQ}
            placeholder="?"
            variant="yellow"
          />

          {/* Remainder (yellow) */}
          <InputOverlay
            left={svgPct(V.rCX, 'x')}
            top={svgPct(V.dY, 'y')}
            value={r}
            onChange={setR}
            placeholder="?"
            variant="yellow"
          />

          {/* End weekday (red) — below end box */}
          <InputOverlay
            left={svgPct(V.epCX, 'x')}
            top={svgPct(125, 'y')}
            value={ew}
            onChange={setEw}
            placeholder="?"
            variant="red"
          />
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className={`w-full max-w-3xl text-center py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${statusClass}`}>
        {statusMsg}
      </div>

      {/* ── Reset button ── */}
      <button
        onClick={handleReset}
        className="bg-slate-100 border border-slate-300 text-slate-600 rounded-lg px-7 py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
      >
        重置答案
      </button>
    </div>
  )
}

// ── InputOverlay ───────────────────────────────────────────────────────────
interface InputOverlayProps {
  left: string
  top: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  variant: 'red' | 'yellow'
}

const variantStyles: Record<InputOverlayProps['variant'], string> = {
  red:    'bg-red-50 text-red-900 placeholder:text-red-300 focus:ring-red-200',
  yellow: 'bg-yellow-50 text-yellow-900 placeholder:text-yellow-300 focus:ring-yellow-200',
}

const InputOverlay: React.FC<InputOverlayProps> = ({
  left, top, value, onChange, placeholder, variant,
}) => (
  <div
    className="absolute pointer-events-auto"
    style={{ left, top, transform: 'translate(-50%, -50%)' }}
  >
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        'w-14 h-9 text-center font-bold text-[15px] rounded-lg border-none outline-none',
        'ring-0 focus:ring-[3px] transition-shadow',
        variantStyles[variant],
      ].join(' ')}
    />
  </div>
)

export default Days
