'use client'

import React, {useState, useCallback, useMemo, memo} from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
export interface MonthlyWeekdayFlowChartProps {
  startDate: string
  endDate: string
  startWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

// ── Constants ──────────────────────────────────────────────────────────────
const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
const FONT = "'PingFang SC','Microsoft YaHei',sans-serif"

// Vertical layout (px) — three rows: date label, days pill, weekday pill
const LBL_H  = 30   // date label row
const GAP1   = 10   // label → days pill
const PILL_H = 38   // days pill row
const GAP2   = 26   // days pill → weekday pill (gap column puts +r here)
const WD_H   = 36   // weekday pill row
const BELOW_H = 22  // below weekday pill for ÷7 label

const WD_Y     = LBL_H + GAP1 + PILL_H + GAP2  // top of weekday row = 104
const WD_MID_Y = WD_Y + WD_H / 2               // arrow center = 122
const CELL_H   = WD_Y + WD_H + BELOW_H         // total cell height = 162

// Horizontal widths
const COL_W = 90   // segment column (date + days + weekday)
const GAP_W = 80   // gap connector (arrow + labels)
const END_W = 64   // end column (final weekday only)

// ── Helpers ────────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function parseDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return {year: y, month: m, day}
}

// ── Segment model ──────────────────────────────────────────────────────────
interface Segment {
  label: string
  correctDays: number
  isEndpoint: boolean
}

function buildSegments(startDate: string, endDate: string): Segment[] {
  const s = parseDate(startDate)
  const e = parseDate(endDate)
  if (s.year !== e.year || s.month === e.month) return []

  const segs: Segment[] = [{
    label: `${s.month}月${s.day}日`,
    correctDays: daysInMonth(s.year, s.month) - s.day + 1,
    isEndpoint: true,
  }]
  for (let m = s.month + 1; m < e.month; m++) {
    segs.push({label: `${m}月`, correctDays: daysInMonth(s.year, m), isEndpoint: false})
  }
  segs.push({label: `${e.month}月${e.day}日`, correctDays: e.day, isEndpoint: true})
  return segs
}

// ── State ──────────────────────────────────────────────────────────────────
interface SegAnswer {days: string; q: string; r: string}

// ── Atom: number input ─────────────────────────────────────────────────────
const Num: React.FC<{
  value: string
  onChange: (v: string) => void
  width?: number
  cls?: string
}> = ({value, onChange, width = 28, cls = ''}) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder="?"
    className={`text-center font-bold text-[12px] border-none outline-none rounded-md ${cls}`}
    style={{width, height: 22, fontFamily: FONT}}
  />
)

// ── DateLabel ──────────────────────────────────────────────────────────────
const DateLabel = memo(({label, isEndpoint}: {label: string; isEndpoint: boolean}) => (
  <div
    className={`px-2.5 py-0.5 rounded-xl text-[11px] font-semibold whitespace-nowrap select-none ${
      isEndpoint ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400'
    }`}
    style={{fontFamily: FONT, lineHeight: `${LBL_H - 4}px`}}
  >
    {label}
  </div>
))
DateLabel.displayName = 'DateLabel'

// ── DaysPill ───────────────────────────────────────────────────────────────
const DaysPill = memo(({
  value, onChange, isEndpoint, correct, wrong,
}: {
  value: string; onChange: (v: string) => void
  isEndpoint: boolean; correct: boolean; wrong: boolean
}) => {
  const bg   = isEndpoint ? 'bg-red-400' : 'bg-rose-100'
  const txt  = isEndpoint ? 'text-white' : 'text-rose-400'
  const ring = correct ? 'ring-2 ring-emerald-400' : wrong ? 'ring-2 ring-red-500' : ''
  return (
    <div className={`flex items-center gap-1 px-2.5 rounded-full shadow-sm ${bg} ${ring}`}
      style={{height: PILL_H, fontFamily: FONT}}>
      <Num
        value={value} onChange={onChange} width={34}
        cls={`bg-transparent ${isEndpoint ? 'text-white placeholder:text-red-200' : 'text-rose-500 placeholder:text-rose-200'}`}
      />
      <span className={`text-sm font-semibold ${txt}`}>天</span>
    </div>
  )
})
DaysPill.displayName = 'DaysPill'

// ── WdPill ─────────────────────────────────────────────────────────────────
type WdRole = 'start' | 'middle' | 'end'
const WD_ROLE_CLS: Record<WdRole, string> = {
  start:  'bg-blue-100 text-blue-700 border-2 border-blue-300',
  middle: 'bg-green-50 text-green-600 border-2 border-green-200',
  end:    'bg-emerald-500 text-white border-2 border-emerald-600 shadow-md',
}

const WdPill = memo(({
  role, fixedLabel, value = '', onChange, correct, wrong,
}: {
  role: WdRole; fixedLabel?: string; value?: string
  onChange?: (v: string) => void; correct?: boolean; wrong?: boolean
}) => {
  const wdName = value && +value >= 1 && +value <= 7 ? WD[+value as 1|2|3|4|5|6|7] : null
  const ring = correct ? 'ring-2 ring-offset-1 ring-emerald-400'
    : wrong ? 'ring-2 ring-offset-1 ring-red-400' : ''
  const base = `flex items-center justify-center rounded-full font-bold text-sm transition-all ${WD_ROLE_CLS[role]} ${ring}`
  const inputCls = role === 'end'
    ? 'bg-transparent text-white placeholder:text-emerald-200'
    : role === 'start'
      ? 'bg-transparent text-blue-700 placeholder:text-blue-300'
      : 'bg-transparent text-green-600 placeholder:text-green-300'

  return (
    <div className={`relative ${base}`} style={{width: COL_W - 10, height: WD_H, fontFamily: FONT}}>
      {fixedLabel ? (
        // Fixed start node — plain text
        fixedLabel
      ) : wdName ? (
        // Valid input — show weekday name + invisible overlay to allow re-editing
        <>
          <span>{wdName}</span>
          {onChange && (
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 rounded-full"
              title="输入 1-7（1=周一…7=周日）"
            />
          )}
        </>
      ) : (
        // Empty — show "周" + visible input
        <div className="flex items-center gap-0.5">
          <span>周</span>
          <input
            value={value}
            onChange={e => onChange?.(e.target.value)}
            placeholder="?"
            className={`w-6 text-center text-xs font-bold border-none outline-none ${inputCls}`}
            style={{fontFamily: FONT}}
          />
        </div>
      )}
    </div>
  )
})
WdPill.displayName = 'WdPill'

// ── SegCol: one column with date label, days pill, weekday pill ────────────
// Layout: col-j aligns with node-j (weekday at start of segment j)
// After crossing seg-j's days via the gap, we arrive at node-j+1
const SegCol = memo(({
  seg, answer, onAnswer, daysOk,
  wdRole, wdFixed, wdValue, wdOnChange, wdCorrect, wdWrong,
}: {
  seg: Segment; answer: SegAnswer
  onAnswer: (p: Partial<SegAnswer>) => void
  daysOk: boolean
  wdRole: WdRole; wdFixed?: string; wdValue?: string
  wdOnChange?: (v: string) => void; wdCorrect?: boolean; wdWrong?: boolean
}) => (
  <div className="relative shrink-0" style={{width: COL_W, height: CELL_H}}>
    {/* Row 1: Date label */}
    <div className="absolute inset-x-0 flex justify-center items-center" style={{top: 0, height: LBL_H}}>
      <DateLabel label={seg.label} isEndpoint={seg.isEndpoint}/>
    </div>

    {/* Row 2: Days pill */}
    <div className="absolute inset-x-0 flex justify-center items-center" style={{top: LBL_H + GAP1, height: PILL_H}}>
      <DaysPill
        value={answer.days} onChange={v => onAnswer({days: v})}
        isEndpoint={seg.isEndpoint}
        correct={daysOk && answer.days !== ''}
        wrong={answer.days !== '' && !daysOk}
      />
    </div>

    {/* Row 3: Weekday pill */}
    <div className="absolute inset-x-0 flex justify-center items-center" style={{top: WD_Y, height: WD_H}}>
      <WdPill
        role={wdRole} fixedLabel={wdFixed} value={wdValue}
        onChange={wdOnChange} correct={wdCorrect} wrong={wdWrong}
      />
    </div>
  </div>
))
SegCol.displayName = 'SegCol'

// ── GapConnector: arrow between two weekday pills + +r and ÷7 labels ──────
// Positioned between SegCol-j and SegCol-(j+1) (or EndCol)
// The arrow is centered at WD_MID_Y to align with weekday pills in SegCols
const GapConnector = memo(({
  answer, onAnswer,
}: {
  answer: SegAnswer
  onAnswer: (p: Partial<SegAnswer>) => void
}) => {
  const roseNum = 'bg-rose-50 text-rose-500 placeholder:text-rose-200'
  return (
    <div className="relative shrink-0" style={{width: GAP_W, height: CELL_H}}>
      {/* "+r" — between days pill row and weekday row */}
      <div
        className="absolute inset-x-0 flex justify-center items-center gap-0.5"
        style={{
          top: WD_Y - 12, height: 20,
          color: '#f43f5e', fontSize: 12, fontWeight: 700, fontFamily: FONT,
        }}
      >
        <span>+</span>
        <Num value={answer.r} onChange={v => onAnswer({r: v})} width={26} cls={roseNum}/>
      </div>

      {/* Arrow line — at WD_MID_Y, same height as weekday pill centers */}
      <div className="absolute inset-x-0 flex items-center" style={{top: WD_MID_Y - 1, height: 2}}>
        <div className="flex-1 bg-slate-300" style={{height: 2}}/>
        <svg width="9" height="9" viewBox="0 0 9 9" className="shrink-0 -ml-px">
          <path d="M1 1.5L7.5 4.5L1 7.5" fill="none" stroke="#94a3b8"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* "q周……r天" — just below weekday pill */}
      <div
        className="absolute inset-x-0 flex justify-center items-center gap-0.5"
        style={{
          top: WD_Y + WD_H - 10, height: BELOW_H,
          color: '#fb7185', fontSize: 11, fontWeight: 700, fontFamily: FONT,
        }}
      >
        <Num value={answer.q} onChange={v => onAnswer({q: v})} width={24} cls={roseNum}/>
        <span>周</span>
        <Num value={answer.r} onChange={v => onAnswer({r: v})} width={24} cls={roseNum}/>
        <span>天</span>
      </div>
    </div>
  )
})
GapConnector.displayName = 'GapConnector'

// ── EndCol: final weekday pill only ───────────────────────────────────────
const EndCol = memo(({
  value, onChange, correct, wrong,
}: {
  value: string; onChange: (v: string) => void; correct: boolean; wrong: boolean
}) => (
  <div className="relative shrink-0" style={{width: END_W, height: CELL_H}}>
    <div className="absolute flex justify-center" style={{top: WD_Y, left: 0, right: 0}}>
      <WdPill role="end" value={value} onChange={onChange} correct={correct} wrong={wrong}/>
    </div>
  </div>
))
EndCol.displayName = 'EndCol'

// ── Main component ─────────────────────────────────────────────────────────
const Month: React.FC<MonthlyWeekdayFlowChartProps> = ({startDate, endDate, startWeekday}) => {
  const segs = useMemo(() => buildSegments(startDate, endDate), [startDate, endDate])
  const n = segs.length

  // answers[j]: days/q/r for segment j and the arrow crossing it
  const [answers, setAnswers] = useState<SegAnswer[]>(() => segs.map(() => ({days: '', q: '', r: ''})))
  // wdInputs[i]: weekday at node i+1 (i = 0..n-1), displayed in SegCol-(i+1) or EndCol
  const [wdInputs, setWdInputs] = useState<string[]>(() => Array(n).fill(''))

  const patchAnswer = useCallback((i: number, p: Partial<SegAnswer>) =>
    setAnswers(prev => {const nx = [...prev]; nx[i] = {...nx[i], ...p}; return nx}), [])

  const patchWd = useCallback((i: number, v: string) =>
    setWdInputs(prev => {const nx = [...prev]; nx[i] = v; return nx}), [])

  const reset = useCallback(() => {
    setAnswers(segs.map(() => ({days: '', q: '', r: ''})))
    setWdInputs(Array(n).fill(''))
  }, [segs, n])

  // correctWds[i]: correct weekday at node i (0 = start, 1..n = after each seg)
  const correctWds = useMemo(() => {
    const c: number[] = [startWeekday]
    for (let i = 0; i < n; i++) c.push(((c[i] - 1 + segs[i].correctDays) % 7) + 1)
    return c
  }, [startWeekday, segs, n])

  const segValid = useMemo(() => segs.map((seg, i) => {
    const a = answers[i]
    const daysOk = a.days !== '' && +a.days === seg.correctDays
    const divOk  = daysOk && a.q !== '' && a.r !== ''
      && +a.q >= 0 && +a.r >= 0 && +a.r < 7 && +a.q * 7 + +a.r === +a.days
    return {daysOk, divOk, allOk: daysOk && divOk}
  }), [segs, answers])

  const wdValid = useMemo(() =>
    wdInputs.map((v, i) => v !== '' && +v >= 1 && +v <= 7 && +v === correctWds[i + 1]),
  [wdInputs, correctWds])

  const allOk = n > 0 && segValid.every(s => s.allOk) && wdValid.every(Boolean)

  const hints = useMemo(() => {
    const h: string[] = []
    segs.forEach((seg, i) => {
      const a = answers[i]
      if (a.days !== '' && +a.days !== seg.correctDays)
        h.push(`${seg.label}天数应为 ${seg.correctDays}`)
      else if (segValid[i].daysOk && !segValid[i].divOk && (a.q !== '' || a.r !== ''))
        h.push(`第 ${i + 1} 段÷7结果不正确`)
    })
    wdInputs.forEach((v, i) => {
      if (v !== '' && !wdValid[i])
        h.push(`节点 ${i + 1} 星期应为 ${WD[correctWds[i + 1]]}`)
    })
    return h
  }, [segs, answers, segValid, wdInputs, wdValid, correctWds])

  if (n === 0) return (
    <div className="text-slate-400 text-sm text-center py-8" style={{fontFamily: FONT}}>
      日期范围无效（需跨月且同年）
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Chart
          Layout: [SegCol-0] [Gap-0] [SegCol-1] [Gap-1] ... [SegCol-n-1] [Gap-n-1] [EndCol]
          SegCol-j: date label + days pill for segment j, weekday pill for node j
          Gap-j:    arrow from node j → node j+1, +r above, ÷7 below
          EndCol:   weekday pill for node n (final answer)
      */}
      <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-100 overflow-x-auto">
        <div
          className="flex items-stretch py-5 px-4"
          style={{width: 'max-content', margin: '0 auto'}}
        >
          {segs.map((seg, j) => (
            <React.Fragment key={j}>
              <SegCol
                seg={seg}
                answer={answers[j]}
                onAnswer={p => patchAnswer(j, p)}
                daysOk={segValid[j].daysOk}
                wdRole={j === 0 ? 'start' : 'middle'}
                wdFixed={j === 0 ? WD[startWeekday] : undefined}
                wdValue={j === 0 ? undefined : wdInputs[j - 1]}
                wdOnChange={j === 0 ? undefined : v => patchWd(j - 1, v)}
                wdCorrect={j === 0 ? true : (wdValid[j - 1] && wdInputs[j - 1] !== '')}
                wdWrong={j > 0 && wdInputs[j - 1] !== '' && !wdValid[j - 1]}
              />
              <GapConnector
                answer={answers[j]}
                onAnswer={p => patchAnswer(j, p)}
              />
            </React.Fragment>
          ))}

          {/* Final weekday (node n) */}
          <EndCol
            value={wdInputs[n - 1]}
            onChange={v => patchWd(n - 1, v)}
            correct={wdValid[n - 1] && wdInputs[n - 1] !== ''}
            wrong={wdInputs[n - 1] !== '' && !wdValid[n - 1]}
          />
        </div>
      </div>

      {/* Status bar */}
      <div
        className={[
          'w-full text-center py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300',
          allOk
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            : hints.length
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200',
        ].join(' ')}
        style={{fontFamily: FONT}}
      >
        {allOk
          ? `全部正确！结束日期是 ${WD[correctWds[n]]}`
          : hints.length
            ? `✗ ${hints.slice(0, 2).join('；')}`
            : '填入红色胶囊（天数）、箭头上方（余数）、箭头下方（商和余数），以及各节点星期（1–7）'}
      </div>

      {/* Reset */}
      <button
        onClick={reset}
        className="bg-slate-100 border border-slate-300 text-slate-600 rounded-lg px-7 py-2 text-sm font-medium hover:bg-slate-200 active:scale-95 transition-all"
        style={{fontFamily: FONT}}
      >
        重置答案
      </button>
    </div>
  )
}

export default Month
