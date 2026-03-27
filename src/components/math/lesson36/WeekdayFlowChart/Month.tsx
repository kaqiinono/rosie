'use client'

import React, {useState, useCallback, useMemo, memo} from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
export interface MonthlyWeekdayFlowChartProps {
  startDate: string
  endDate: string
  /** Forward mode: know start weekday, fill toward end */
  startWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** Backward mode: know end weekday, fill toward start */
  endWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

// ── Constants ──────────────────────────────────────────────────────────────
const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
const FONT = "'PingFang SC','Microsoft YaHei',sans-serif"

// Layout constants
const LBL_H  = 30   // date label row height
const PILL_H = 38   // days pill height
const WD_H   = 36   // weekday pill height
const COL_W  = 90   // weekday pill width = COL_W - 10

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

// ── Main component ─────────────────────────────────────────────────────────
const Month: React.FC<MonthlyWeekdayFlowChartProps> = ({startDate, endDate, startWeekday, endWeekday}) => {
  const mode: 'forward' | 'backward' = startWeekday ? 'forward' : 'backward'
  const segs = useMemo(() => buildSegments(startDate, endDate), [startDate, endDate])
  const n = segs.length

  // answers[j]: days/q/r for segment j and the arrow crossing it
  const [answers, setAnswers] = useState<SegAnswer[]>(() => segs.map(() => ({days: '', q: '', r: ''})))
  // forward:  wdInputs[i] = weekday at node i+1 (after seg i), filled by user
  // backward: wdInputs[i] = weekday at node i   (before seg i), filled by user
  const [wdInputs, setWdInputs] = useState<string[]>(() => Array(n).fill(''))

  const patchAnswer = useCallback((i: number, p: Partial<SegAnswer>) =>
    setAnswers(prev => {const nx = [...prev]; nx[i] = {...nx[i], ...p}; return nx}), [])

  const patchWd = useCallback((i: number, v: string) =>
    setWdInputs(prev => {const nx = [...prev]; nx[i] = v; return nx}), [])

  const reset = useCallback(() => {
    setAnswers(segs.map(() => ({days: '', q: '', r: ''})))
    setWdInputs(Array(n).fill(''))
  }, [segs, n])

  // correctWds[i]: correct weekday at node i (0 = startDate node, n = endDate node)
  const correctWds = useMemo(() => {
    const c: number[] = new Array(n + 1)
    if (mode === 'forward') {
      c[0] = startWeekday!
      for (let i = 0; i < n; i++) c[i + 1] = ((c[i] - 1 + segs[i].correctDays) % 7) + 1
    } else {
      c[n] = endWeekday!
      for (let i = n - 1; i >= 0; i--) c[i] = ((c[i + 1] - 1 - segs[i].correctDays % 7 + 700) % 7) + 1
    }
    return c
  }, [mode, startWeekday, endWeekday, segs, n])

  const segValid = useMemo(() => segs.map((seg, i) => {
    const a = answers[i]
    const daysOk = a.days !== '' && +a.days === seg.correctDays
    const divOk  = daysOk && a.q !== '' && a.r !== ''
      && +a.q >= 0 && +a.r >= 0 && +a.r < 7 && +a.q * 7 + +a.r === +a.days
    return {daysOk, divOk, allOk: daysOk && divOk}
  }), [segs, answers])

  const wdValid = useMemo(() =>
    wdInputs.map((v, i) => {
      const target = mode === 'forward' ? correctWds[i + 1] : correctWds[i]
      return v !== '' && +v >= 1 && +v <= 7 && +v === target
    }),
  [wdInputs, correctWds, mode])

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
      const target = mode === 'forward' ? correctWds[i + 1] : correctWds[i]
      if (v !== '' && !wdValid[i])
        h.push(`节点 ${mode === 'forward' ? i + 1 : i} 星期应为 ${WD[target]}`)
    })
    return h
  }, [segs, answers, segValid, wdInputs, wdValid, correctWds, mode])

  if (n === 0) return (
    <div className="text-slate-400 text-sm text-center py-8" style={{fontFamily: FONT}}>
      日期范围无效（需跨月且同年）
    </div>
  )

  // j = segment index (0..n-1); node j is the weekday pill shown in that row
  const wdProps = (j: number) => {
    if (mode === 'forward') {
      return {
        role: (j === 0 ? 'start' : 'middle') as WdRole,
        fixedLabel: j === 0 ? WD[startWeekday!] : undefined,
        value: j === 0 ? undefined : wdInputs[j - 1],
        onChange: j === 0 ? undefined : (v: string) => patchWd(j - 1, v),
        correct: j === 0 ? true : (wdValid[j - 1] && wdInputs[j - 1] !== ''),
        wrong: j > 0 && wdInputs[j - 1] !== '' && !wdValid[j - 1],
      }
    } else {
      return {
        role: (j === 0 ? 'start' : 'middle') as WdRole,
        fixedLabel: undefined,
        value: wdInputs[j],
        onChange: (v: string) => patchWd(j, v),
        correct: wdValid[j] && wdInputs[j] !== '',
        wrong: wdInputs[j] !== '' && !wdValid[j],
      }
    }
  }

  const roseNum = 'bg-rose-50 text-rose-500 placeholder:text-rose-200'

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Layout: 3 columns [date label | days pill | weekday pill + arrows] ── */}
      <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-100">
        <div
          className="grid p-4 gap-x-3 w-full"
          style={{gridTemplateColumns: 'auto auto auto'}}
        >
          {segs.map((seg, j) => {
            const wp = wdProps(j)
            const daysOk = segValid[j].daysOk
            return (
              <React.Fragment key={j}>
                {/* Data row: date | days | weekday */}
                <div className="flex items-center justify-end pr-2 py-2">
                  <DateLabel label={seg.label} isEndpoint={seg.isEndpoint}/>
                </div>
                <div className="flex items-center justify-center px-1 py-2">
                  <DaysPill
                    value={answers[j].days}
                    onChange={v => patchAnswer(j, {days: v})}
                    isEndpoint={seg.isEndpoint}
                    correct={daysOk && answers[j].days !== ''}
                    wrong={answers[j].days !== '' && !daysOk}
                  />
                </div>
                <div className="flex items-center justify-center pl-2 py-2">
                  <WdPill {...wp}/>
                </div>

                {/* Gap row: empty | empty | vertical arrow with labels */}
                <div/>
                <div/>
                <div className="flex items-center justify-center" style={{minHeight: 44}}>
                  <div className="flex items-center gap-2">
                    {/* ±r on left of arrow */}
                    <div className="flex items-center gap-0.5"
                      style={{color: '#f43f5e', fontSize: 12, fontWeight: 700, fontFamily: FONT}}>
                      <span>{mode === 'forward' ? '+' : '−'}</span>
                      <Num value={answers[j].r} onChange={v => patchAnswer(j, {r: v})} width={24} cls={roseNum}/>
                    </div>
                    {/* Vertical arrow — down (forward) or up (backward) */}
                    <div className="flex flex-col items-center" style={{height: 36}}>
                      {mode === 'backward' && (
                        <svg width="9" height="9" viewBox="0 0 9 9">
                          <path d="M1.5 8L4.5 1.5L7.5 8" fill="none" stroke="#94a3b8"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      <div className="flex-1 bg-slate-300" style={{width: 2}}/>
                      {mode === 'forward' && (
                        <svg width="9" height="9" viewBox="0 0 9 9">
                          <path d="M1.5 1L4.5 7.5L7.5 1" fill="none" stroke="#94a3b8"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    {/* ÷7 on right of arrow */}
                    <div className="flex items-center gap-0.5"
                      style={{color: '#fb7185', fontSize: 11, fontWeight: 700, fontFamily: FONT}}>
                      <Num value={answers[j].q} onChange={v => patchAnswer(j, {q: v})} width={22} cls={roseNum}/>
                      <span>周</span>
                      <span style={{color: '#94a3b8'}}>……</span>
                      <Num value={answers[j].r} onChange={v => patchAnswer(j, {r: v})} width={22} cls={roseNum}/>
                      <span>天</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            )
          })}

          {/* Final weekday row */}
          <div className="py-2"/><div className="py-2"/>
          <div className="flex items-center justify-center pl-2 py-2">
            {mode === 'forward' ? (
              <WdPill
                role="end"
                value={wdInputs[n - 1]}
                onChange={v => patchWd(n - 1, v)}
                correct={wdValid[n - 1] && wdInputs[n - 1] !== ''}
                wrong={wdInputs[n - 1] !== '' && !wdValid[n - 1]}
              />
            ) : (
              <WdPill role="end" fixedLabel={WD[endWeekday!]}/>
            )}
          </div>
        </div>
      </div>

      {/* Status bar + reset */}
      <div
        className={[
          'w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-300',
          allOk
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            : hints.length
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200',
        ].join(' ')}
        style={{fontFamily: FONT}}
      >
        <span className="flex-1">
          {allOk
            ? mode === 'forward'
              ? `全部正确！结束日期是 ${WD[correctWds[n]]}`
              : `全部正确！开始日期是 ${WD[correctWds[0]]}`
            : hints.length
              ? `✗ ${hints.slice(0, 2).join('；')}`
              : mode === 'forward'
                ? '填入红色胶囊（天数）、箭头上方（余数）、箭头下方（商和余数），以及各节点星期（1–7）'
                : '已知结束日期星期，从右向左倒推：填入天数、减去余数、各节点星期（1–7）'}
        </span>
        <button
          onClick={reset}
          className="shrink-0 cursor-pointer rounded-full bg-white/50 px-2.5 py-0.5 text-[11px] font-medium hover:bg-white/80 transition-all active:scale-95"
          style={{ border: '1px solid rgba(0,0,0,0.12)', fontFamily: FONT }}
        >
          ↺ 重置
        </button>
      </div>
    </div>
  )
}

export default Month
