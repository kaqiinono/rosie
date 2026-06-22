'use client'

import React, { useState, useCallback, useMemo, memo } from 'react'
import Month from "@/components/math/lesson36/WeekdayFlowChart/Month";

// ── Re-export Month component inline (跨月部分) ────────────────────────────
// (Paste the MonthlyWeekdayFlowChartProps / Month component here if co-locating;
//  or import from '@/components/Month2'. Below we embed a minimal version.)

// ── Types ──────────────────────────────────────────────────────────────────
export interface YearlyWeekdayFlowChartProps {
  /** Start date  e.g. "2021-01-01" */
  startDate: string
  /** End date    e.g. "2026-01-01" */
  endDate: string
  /** Forward mode: weekday of startDate, 1=Mon … 7=Sun */
  startWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** Backward mode: weekday of the last year node (yearEndDate), 1=Mon … 7=Sun */
  endWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

// ── Constants ──────────────────────────────────────────────────────────────
const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
const FONT = "'PingFang SC','Microsoft YaHei',sans-serif"

// Vertical layout (px)
const DATE_H   = 36   // date box height
const ARROW_H  = 56   // arrow section height (label + line + arrowhead)
const _ROW_H   = DATE_H + ARROW_H  // one "step" height = 92

// Horizontal widths
const DATE_W   = 140  // blue date box width
const WD_W     = 88   // red weekday pill width
const COL_GAP  = 28   // gap between date col and weekday col

// ── Helpers ────────────────────────────────────────────────────────────────
function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function _daysInYear(y: number) {
  return isLeapYear(y) ? 366 : 365
}

function parseDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return { year: y, month: m, day: day }
}

/** Format "YYYYMMDD" from year number and optional month/day (defaults to Jan 1) */
function formatYearDate(y: number, month = 1, day = 1) {
  return `${y}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
}

// ── Segment model ──────────────────────────────────────────────────────────
interface YearSegment {
  fromYear: number   // e.g. 2021
  days: number       // 365 or 366
}

/**
 * Build year segments between startDate and endDate.
 * Each segment = Jan 1 of year X → Jan 1 of year X+1 (i.e. daysInYear(X) days).
 * The final row is simply the endDate label (no further segment).
 *
 * Works only when startDate and endDate are both Jan 1 (same-month-day).
 * If they're not, we still model year rows and leave the remainder to
 * the cross-month sub-component.
 */
function buildYearSegments(startDate: string, endDate: string): YearSegment[] {
  const s = parseDate(startDate)
  const e = parseDate(endDate)
  if (s.year >= e.year) return []

  const segs: YearSegment[] = []
  for (let y = s.year; y < e.year; y++) {
    // Days from s's month/day in year y to same month/day in year y+1
    // For simplicity (and per the image which shows Jan 1 → Jan 1):
    // if both dates are Jan 1, it's simply daysInYear(y).
    // General case: count days from (y, s.month, s.day) to (y+1, e.month, e.day)
    // For cross-year "same anniversary" we use daysInYear(y).
    const fromMs  = new Date(y,     s.month - 1, s.day).getTime()
    const toMs    = new Date(y + 1, s.month - 1, s.day).getTime()
    const days    = Math.round((toMs - fromMs) / 86400000)
    segs.push({ fromYear: y, days })
  }
  return segs
}

/** Correct weekday after adding `days` to weekday `wd` (1-based) */
function advanceWeekday(wd: number, days: number): number {
  return ((wd - 1 + days) % 7) + 1
}

/** Does end date match start date month/day? (pure year-crossing) */
function isPureYearCrossing(startDate: string, endDate: string): boolean {
  const s = parseDate(startDate)
  const e = parseDate(endDate)
  return s.month === e.month && s.day === e.day
}

// ── Sub-components ─────────────────────────────────────────────────────────

const NumInput: React.FC<{
  value: string
  onChange: (v: string) => void
  width?: number
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}> = ({ value, onChange, width = 36, placeholder = '?', className = '', style }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`text-center font-bold border-none outline-none rounded-md ${className}`}
    style={{ width, fontFamily: FONT, ...style }}
  />
)

// Blue date box (fixed label)
const DateBox = memo(({ label, isFixed }: { label: string; isFixed: boolean }) => (
  <div
    className={`flex items-center justify-center rounded-2xl text-sm font-semibold select-none
      ${isFixed ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-500'}`}
    style={{ width: DATE_W, height: DATE_H, fontFamily: FONT, letterSpacing: 1 }}
  >
    {label}
  </div>
))
DateBox.displayName = 'DateBox'

// Pink weekday pill — fixed (start) or input
const WeekdayPill = memo(({
  fixedLabel,
  value,
  onChange,
  correct,
  wrong,
}: {
  fixedLabel?: string
  value?: string
  onChange?: (v: string) => void
  correct?: boolean
  wrong?: boolean
}) => {
  const wdName = value && +value >= 1 && +value <= 7 ? WD[+value as 1|2|3|4|5|6|7] : null
  const ring = correct ? 'ring-2 ring-emerald-400' : wrong ? 'ring-2 ring-red-400' : ''

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-sm
        bg-rose-100 text-rose-500 ${ring}`}
      style={{ width: WD_W, height: DATE_H, fontFamily: FONT, position: 'relative' }}
    >
      {fixedLabel ? (
        <span>{fixedLabel}</span>
      ) : wdName ? (
        <>
          <span>{wdName}</span>
          {onChange && (
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 rounded-full"
              title="输入1-7（1=周一…7=周日）"
            />
          )}
        </>
      ) : (
        <div className="flex items-center gap-0.5">
          <span>周</span>
          <input
            value={value ?? ''}
            onChange={e => onChange?.(e.target.value)}
            placeholder="?"
            className="w-6 text-center text-xs font-bold border-none outline-none bg-transparent text-rose-500 placeholder:text-rose-200"
            style={{ fontFamily: FONT }}
          />
        </div>
      )}
    </div>
  )
})
WeekdayPill.displayName = 'WeekdayPill'

// Arrow section between two rows
// Shows: left side = days input with downward arrow; right side = +N input with downward arrow
const ArrowSection = memo(({
  daysValue,
  onDaysChange,
  plusValue,
  onPlusChange,
  correctDays,
  correctPlus,
  direction = 'forward',
}: {
  daysValue: string
  onDaysChange: (v: string) => void
  plusValue: string
  onPlusChange: (v: string) => void
  correctDays: number
  correctPlus: number
  direction?: 'forward' | 'backward'
}) => {
  const daysOk  = daysValue  !== '' && +daysValue  === correctDays
  const daysErr = daysValue  !== '' && +daysValue  !== correctDays
  const plusOk  = plusValue  !== '' && +plusValue  === correctPlus
  const plusErr = plusValue  !== '' && +plusValue  !== correctPlus
  const sign = direction === 'forward' ? '+' : '−'

  const arrowSvg = direction === 'forward' ? (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ marginTop: 1 }}>
      <line x1="5" y1="0" x2="5" y2="10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
      <path d="M1.5 7.5L5 11.5L8.5 7.5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ marginBottom: 1 }}>
      <path d="M1.5 6.5L5 2.5L8.5 6.5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="5" y1="4" x2="5" y2="14" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div className="flex" style={{ height: ARROW_H }}>
      {/* Days column */}
      <div
        className="flex flex-col items-center justify-center gap-0.5"
        style={{ width: DATE_W, flex: 1 }}
      >
        {direction === 'backward' && arrowSvg}
        <div
          className={`flex items-center gap-0.5 px-2.5 rounded-lg text-xs font-bold
            ${daysOk ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-300'
              : daysErr ? 'bg-red-50 text-red-500 ring-1 ring-red-300'
              : 'bg-slate-100 text-slate-500'}`}
          style={{ height: 22, fontFamily: FONT }}
        >
          <NumInput
            value={daysValue}
            onChange={onDaysChange}
            width={36}
            className={`bg-transparent text-xs
              ${daysOk ? 'text-emerald-600 placeholder:text-emerald-200'
                : daysErr ? 'text-red-500 placeholder:text-red-200'
                : 'text-slate-500 placeholder:text-slate-300'}`}
          />
          <span>天</span>
        </div>
        {direction === 'forward' && arrowSvg}
      </div>

      {/* Plus/minus remainder column */}
      <div
        className="flex flex-col items-center justify-center gap-0.5"
        style={{ width: COL_GAP + WD_W, paddingLeft: COL_GAP, flex: 1 }}
      >
        {direction === 'backward' && arrowSvg}
        <div
          className={`flex items-center gap-0.5 px-2 rounded-lg text-xs font-bold
            ${plusOk ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-300'
              : plusErr ? 'bg-red-50 text-red-500 ring-1 ring-red-300'
              : 'bg-rose-50 text-rose-400'}`}
          style={{ height: 22, fontFamily: FONT }}
        >
          <span>{sign}</span>
          <NumInput
            value={plusValue}
            onChange={onPlusChange}
            width={28}
            className={`bg-transparent text-xs
              ${plusOk ? 'text-emerald-600 placeholder:text-emerald-200'
                : plusErr ? 'text-red-500 placeholder:text-red-200'
                : 'text-rose-400 placeholder:text-rose-200'}`}
          />
        </div>
        {direction === 'forward' && arrowSvg}
      </div>
    </div>
  )
})
ArrowSection.displayName = 'ArrowSection'

// ── Month component (inline minimal version for cross-month tail) ──────────
// Full implementation matches Month.tsx but embedded here for self-containment
// If Month2 is already in scope, replace this with: import Month from './Month2'

const MONTH_WD   = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
const M_LBL_H    = 30
const M_PILL_H   = 38
const M_WD_H     = 36
const M_GAP2     = 26
const M_BELOW_H  = 22
const M_WD_Y     = M_LBL_H + 10 + M_PILL_H + M_GAP2
const M_WD_MID_Y = M_WD_Y + M_WD_H / 2
const M_CELL_H   = M_WD_Y + M_WD_H + M_BELOW_H
const M_COL_W    = 90
const M_GAP_W    = 80
const M_END_W    = 64

function mDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}
function mParseDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return { year: y, month: m, day }
}

interface MSegment { label: string; correctDays: number; isEndpoint: boolean }
function mBuildSegments(startDate: string, endDate: string): MSegment[] {
  const s = mParseDate(startDate)
  const e = mParseDate(endDate)
  if (s.year !== e.year || s.month === e.month) return []
  const segs: MSegment[] = [{
    label: `${s.month}月${s.day}日`,
    correctDays: mDaysInMonth(s.year, s.month) - s.day + 1,
    isEndpoint: true,
  }]
  for (let m = s.month + 1; m < e.month; m++)
    segs.push({ label: `${m}月`, correctDays: mDaysInMonth(s.year, m), isEndpoint: false })
  segs.push({ label: `${e.month}月${e.day}日`, correctDays: e.day, isEndpoint: true })
  return segs
}

interface MSegAnswer { days: string; q: string; r: string }

const MNum: React.FC<{ value: string; onChange: (v: string) => void; width?: number; cls?: string }> =
  ({ value, onChange, width = 28, cls = '' }) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder="?"
      className={`text-center font-bold text-[12px] border-none outline-none rounded-md ${cls}`}
      style={{ width, height: 22, fontFamily: FONT }} />
  )

const MDaysPill = memo(({ value, onChange, isEndpoint, correct, wrong }:
  { value: string; onChange: (v: string) => void; isEndpoint: boolean; correct: boolean; wrong: boolean }) => {
  const bg  = isEndpoint ? 'bg-red-400' : 'bg-rose-100'
  const txt = isEndpoint ? 'text-white' : 'text-rose-400'
  const ring = correct ? 'ring-2 ring-emerald-400' : wrong ? 'ring-2 ring-red-500' : ''
  return (
    <div className={`flex items-center gap-1 px-2.5 rounded-full shadow-sm ${bg} ${ring}`}
      style={{ height: M_PILL_H, fontFamily: FONT }}>
      <MNum value={value} onChange={onChange} width={34}
        cls={`bg-transparent ${isEndpoint ? 'text-white placeholder:text-red-200' : 'text-rose-500 placeholder:text-rose-200'}`} />
      <span className={`text-sm font-semibold ${txt}`}>天</span>
    </div>
  )
})
MDaysPill.displayName = 'MDaysPill'

type MWdRole = 'start' | 'middle' | 'end'
const M_WD_ROLE_CLS: Record<MWdRole, string> = {
  start:  'bg-blue-100 text-blue-700 border-2 border-blue-300',
  middle: 'bg-green-50 text-green-600 border-2 border-green-200',
  end:    'bg-emerald-500 text-white border-2 border-emerald-600 shadow-md',
}
const MWdPill = memo(({ role, fixedLabel, value = '', onChange, correct, wrong }:
  { role: MWdRole; fixedLabel?: string; value?: string; onChange?: (v: string) => void; correct?: boolean; wrong?: boolean }) => {
  const wdName = value && +value >= 1 && +value <= 7 ? MONTH_WD[+value as 1|2|3|4|5|6|7] : null
  const ring = correct ? 'ring-2 ring-offset-1 ring-emerald-400' : wrong ? 'ring-2 ring-offset-1 ring-red-400' : ''
  const base = `flex items-center justify-center rounded-full font-bold text-sm transition-all ${M_WD_ROLE_CLS[role]} ${ring}`
  const inputCls = role === 'end' ? 'bg-transparent text-white placeholder:text-emerald-200'
    : role === 'start' ? 'bg-transparent text-blue-700 placeholder:text-blue-300'
    : 'bg-transparent text-green-600 placeholder:text-green-300'
  return (
    <div className={`relative ${base}`} style={{ width: M_COL_W - 10, height: M_WD_H, fontFamily: FONT }}>
      {fixedLabel ? fixedLabel : wdName ? (
        <>{wdName}{onChange && <input value={value} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 rounded-full"
          title="输入 1-7（1=周一…7=周日）" />}</>
      ) : (
        <div className="flex items-center gap-0.5">
          <span>周</span>
          <input value={value} onChange={e => onChange?.(e.target.value)} placeholder="?"
            className={`w-6 text-center text-xs font-bold border-none outline-none ${inputCls}`}
            style={{ fontFamily: FONT }} />
        </div>
      )}
    </div>
  )
})
MWdPill.displayName = 'MWdPill'

const MSegCol = memo(({ seg, answer, onAnswer, daysOk, wdRole, wdFixed, wdValue, wdOnChange, wdCorrect, wdWrong }:
  { seg: MSegment; answer: MSegAnswer; onAnswer: (p: Partial<MSegAnswer>) => void; daysOk: boolean
    wdRole: MWdRole; wdFixed?: string; wdValue?: string; wdOnChange?: (v: string) => void
    wdCorrect?: boolean; wdWrong?: boolean }) => (
  <div className="relative shrink-0" style={{ width: M_COL_W, height: M_CELL_H }}>
    <div className="absolute inset-x-0 flex justify-center items-center" style={{ top: 0, height: M_LBL_H }}>
      <div className={`px-2.5 py-0.5 rounded-xl text-[11px] font-semibold whitespace-nowrap select-none
        ${seg.isEndpoint ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400'}`}
        style={{ fontFamily: FONT, lineHeight: `${M_LBL_H - 4}px` }}>{seg.label}</div>
    </div>
    <div className="absolute inset-x-0 flex justify-center items-center" style={{ top: M_LBL_H + 10, height: M_PILL_H }}>
      <MDaysPill value={answer.days} onChange={v => onAnswer({ days: v })} isEndpoint={seg.isEndpoint}
        correct={daysOk && answer.days !== ''} wrong={answer.days !== '' && !daysOk} />
    </div>
    <div className="absolute inset-x-0 flex justify-center items-center" style={{ top: M_WD_Y, height: M_WD_H }}>
      <MWdPill role={wdRole} fixedLabel={wdFixed} value={wdValue} onChange={wdOnChange}
        correct={wdCorrect} wrong={wdWrong} />
    </div>
  </div>
))
MSegCol.displayName = 'MSegCol'

const MGapConnector = memo(({ answer, onAnswer }:
  { answer: MSegAnswer; onAnswer: (p: Partial<MSegAnswer>) => void }) => {
  const roseNum = 'bg-rose-50 text-rose-500 placeholder:text-rose-200'
  return (
    <div className="relative shrink-0" style={{ width: M_GAP_W, height: M_CELL_H }}>
      <div className="absolute inset-x-0 flex justify-center items-center gap-0.5"
        style={{ top: M_WD_Y - 12, height: 20, color: '#f43f5e', fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
        <span>+</span><MNum value={answer.r} onChange={v => onAnswer({ r: v })} width={26} cls={roseNum} />
      </div>
      <div className="absolute inset-x-0 flex items-center" style={{ top: M_WD_MID_Y - 1, height: 2 }}>
        <div className="flex-1 bg-slate-300" style={{ height: 2 }} />
        <svg width="9" height="9" viewBox="0 0 9 9" className="shrink-0 -ml-px">
          <path d="M1 1.5L7.5 4.5L1 7.5" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="absolute inset-x-0 flex justify-center items-center gap-0.5"
        style={{ top: M_WD_Y + M_WD_H - 10, height: M_BELOW_H, color: '#fb7185', fontSize: 11, fontWeight: 700, fontFamily: FONT }}>
        <MNum value={answer.q} onChange={v => onAnswer({ q: v })} width={24} cls={roseNum} />
        <span>周</span>
        <MNum value={answer.r} onChange={v => onAnswer({ r: v })} width={24} cls={roseNum} />
        <span>天</span>
      </div>
    </div>
  )
})
MGapConnector.displayName = 'MGapConnector'

const MEndCol = memo(({ value, onChange, correct, wrong }:
  { value: string; onChange: (v: string) => void; correct: boolean; wrong: boolean }) => (
  <div className="relative shrink-0" style={{ width: M_END_W, height: M_CELL_H }}>
    <div className="absolute flex justify-center" style={{ top: M_WD_Y, left: 0, right: 0 }}>
      <MWdPill role="end" value={value} onChange={onChange} correct={correct} wrong={wrong} />
    </div>
  </div>
))
MEndCol.displayName = 'MEndCol'

interface MonthTailProps {
  startDate: string
  endDate: string
  startWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

const MonthTail: React.FC<MonthTailProps> = ({ startDate, endDate, startWeekday }) => {
  const segs = useMemo(() => mBuildSegments(startDate, endDate), [startDate, endDate])
  const n = segs.length
  const [answers, setAnswers] = useState<MSegAnswer[]>(() => segs.map(() => ({ days: '', q: '', r: '' })))
  const [wdInputs, setWdInputs] = useState<string[]>(() => Array(n).fill(''))

  const _patchAnswer = useCallback((i: number, p: Partial<MSegAnswer>) =>
    setAnswers(prev => { const nx = [...prev]; nx[i] = { ...nx[i], ...p }; return nx }), [])
  const _patchWd = useCallback((i: number, v: string) =>
    setWdInputs(prev => { const nx = [...prev]; nx[i] = v; return nx }), [])
  const reset = useCallback(() => {
    setAnswers(segs.map(() => ({ days: '', q: '', r: '' })))
    setWdInputs(Array(n).fill(''))
  }, [segs, n])

  const correctWds = useMemo(() => {
    const c: number[] = [startWeekday]
    for (let i = 0; i < n; i++) c.push(((c[i] - 1 + segs[i].correctDays) % 7) + 1)
    return c
  }, [startWeekday, segs, n])

  const segValid = useMemo(() => segs.map((seg, i) => {
    const a = answers[i]
    const daysOk = a.days !== '' && +a.days === seg.correctDays
    const divOk  = daysOk && a.q !== '' && a.r !== '' && +a.q >= 0 && +a.r >= 0 && +a.r < 7 && +a.q * 7 + +a.r === +a.days
    return { daysOk, divOk, allOk: daysOk && divOk }
  }), [segs, answers])

  const wdValid = useMemo(() =>
    wdInputs.map((v, i) => v !== '' && +v >= 1 && +v <= 7 && +v === correctWds[i + 1]),
  [wdInputs, correctWds])

  const allOk = n > 0 && segValid.every(s => s.allOk) && wdValid.every(Boolean)

  const hints = useMemo(() => {
    const h: string[] = []
    segs.forEach((seg, i) => {
      const a = answers[i]
      if (a.days !== '' && +a.days !== seg.correctDays) h.push(`${seg.label}天数应为 ${seg.correctDays}`)
      else if (segValid[i].daysOk && !segValid[i].divOk && (a.q !== '' || a.r !== '')) h.push(`第 ${i + 1} 段÷7结果不正确`)
    })
    wdInputs.forEach((v, i) => { if (v !== '' && !wdValid[i]) h.push(`节点 ${i + 1} 星期应为 ${MONTH_WD[correctWds[i + 1]]}`) })
    return h
  }, [segs, answers, segValid, wdInputs, wdValid, correctWds])

  if (n === 0) return null

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-xs text-slate-400 font-medium" style={{ fontFamily: FONT }}>
        ↓ 跨月计算（{startDate} → {endDate}）
      </div>
      <div className="w-full bg-white rounded-2xl shadow border border-slate-100 overflow-x-auto">
        <div className="flex items-stretch py-5 px-4" style={{ width: 'max-content', margin: '0 auto' }}>
          <Month startDate={startDate} endDate={endDate} startWeekday={startWeekday}  />
        </div>
      </div>
      <div className={['w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-300',
        allOk ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
          : hints.length ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-slate-100 text-slate-500 border border-slate-200'].join(' ')}
        style={{ fontFamily: FONT }}>
        <span className="flex-1">
          {allOk ? `✓ 跨月计算正确！结束日期是 ${MONTH_WD[correctWds[n]]}`
            : hints.length ? `✗ ${hints.slice(0, 2).join('；')}`
            : '填入跨月各段天数、÷7商余、节点星期'}
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

// ── Main component ─────────────────────────────────────────────────────────
interface YearRowAnswer { days: string; plus: string }

const Year: React.FC<YearlyWeekdayFlowChartProps> = ({ startDate, endDate, startWeekday, endWeekday }) => {
  const mode: 'forward' | 'backward' = startWeekday ? 'forward' : 'backward'
  const segs = useMemo(() => buildYearSegments(startDate, endDate), [startDate, endDate])
  const n = segs.length

  // Per-row inputs: days and ±N
  const [answers, setAnswers] = useState<YearRowAnswer[]>(() => segs.map(() => ({ days: '', plus: '' })))
  // forward:  wdInputs[i] = weekday at node i+1 (after row i)
  // backward: wdInputs[i] = weekday at node i   (before row i)
  const [wdInputs, setWdInputs] = useState<string[]>(() => Array(n).fill(''))

  const patchAnswer = useCallback((i: number, p: Partial<YearRowAnswer>) =>
    setAnswers(prev => { const nx = [...prev]; nx[i] = { ...nx[i], ...p }; return nx }), [])
  const patchWd = useCallback((i: number, v: string) =>
    setWdInputs(prev => { const nx = [...prev]; nx[i] = v; return nx }), [])
  const reset = useCallback(() => {
    setAnswers(segs.map(() => ({ days: '', plus: '' })))
    setWdInputs(Array(n).fill(''))
  }, [segs, n])

  // Correct weekdays at each node (0 = startDate node, n = yearEndDate node)
  const correctWds = useMemo(() => {
    const c: number[] = new Array(n + 1)
    if (mode === 'forward') {
      c[0] = startWeekday!
      for (let i = 0; i < n; i++) c[i + 1] = advanceWeekday(c[i], segs[i].days)
    } else {
      c[n] = endWeekday!
      for (let i = n - 1; i >= 0; i--) c[i] = ((c[i + 1] - 1 - segs[i].days % 7 + 700) % 7) + 1
    }
    return c
  }, [mode, startWeekday, endWeekday, segs, n])

  // Correct ±N (days % 7) for each row
  const correctPlus = useMemo(() => segs.map(s => s.days % 7), [segs])

  // Validation per row
  const rowValid = useMemo(() => segs.map((seg, i) => {
    const a = answers[i]
    const daysOk = a.days !== '' && +a.days === seg.days
    const plusOk = a.plus !== '' && +a.plus === correctPlus[i]
    return { daysOk, plusOk, allOk: daysOk && plusOk }
  }), [segs, answers, correctPlus])

  const wdValid = useMemo(() =>
    wdInputs.map((v, i) => {
      const target = mode === 'forward' ? correctWds[i + 1] : correctWds[i]
      return v !== '' && +v >= 1 && +v <= 7 && +v === target
    }),
  [wdInputs, correctWds, mode])

  // Check if we need cross-month tail
  const needsMonthTail = !isPureYearCrossing(startDate, endDate)
  // The last year node weekday (yearEndDate) — used as startWeekday for cross-month tail
  const finalYearWd = correctWds[n] as 1|2|3|4|5|6|7

  // Build the year-end date and end date for cross-month tail
  const endYear  = parseDate(endDate).year
  const startD   = parseDate(startDate)
  const yearEndDate   = `${endYear}-${String(startD.month).padStart(2,'0')}-${String(startD.day).padStart(2,'0')}`

  const allYearOk = n > 0 && rowValid.every(r => r.allOk) && wdValid.every(Boolean)

  const hints = useMemo(() => {
    const h: string[] = []
    segs.forEach((seg, i) => {
      const a = answers[i]
      if (a.days !== '' && +a.days !== seg.days) h.push(`${seg.fromYear}年应为 ${seg.days} 天`)
      if (a.days !== '' && +a.days === seg.days && a.plus !== '' && +a.plus !== correctPlus[i])
        h.push(`第 ${i+1} 行余数应为 ${correctPlus[i]}`)
    })
    wdInputs.forEach((v, i) => {
      const target = mode === 'forward' ? correctWds[i + 1] : correctWds[i]
      const yearLabel = mode === 'forward'
        ? `${segs[i]?.fromYear + 1}年${String(startD.month).padStart(2,'0')}月${String(startD.day).padStart(2,'0')}日`
        : `${segs[i]?.fromYear}年${String(startD.month).padStart(2,'0')}月${String(startD.day).padStart(2,'0')}日`
      if (v !== '' && !wdValid[i]) h.push(`${yearLabel}应为 ${WD[target]}`)
    })
    return h
  }, [segs, answers, correctPlus, wdInputs, wdValid, correctWds, mode, startD])

  if (n === 0) return (
    <div className="text-slate-400 text-sm text-center py-8" style={{ fontFamily: FONT }}>
      日期范围无效（需跨年）
    </div>
  )

  // Build rows: alternating DateRow and ArrowRow
  // Row i: DateBox(year i) + WeekdayPill(year i) | ArrowSection(days/plus for seg i)
  const rows: React.ReactNode[] = []

  for (let i = 0; i < n; i++) {
    const yearLabel = formatYearDate(segs[i].fromYear, startD.month, startD.day)
    // Date + weekday row
    rows.push(
      <div key={`date-${i}`} className="flex items-center" style={{ gap: COL_GAP }}>
        <DateBox label={yearLabel} isFixed={i === 0} />
        {mode === 'forward' ? (
          <WeekdayPill
            fixedLabel={i === 0 ? WD[startWeekday!] : undefined}
            value={i === 0 ? undefined : wdInputs[i - 1]}
            onChange={i === 0 ? undefined : v => patchWd(i - 1, v)}
            correct={i === 0 ? true : (wdValid[i - 1] && wdInputs[i - 1] !== '')}
            wrong={i > 0 && wdInputs[i - 1] !== '' && !wdValid[i - 1]}
          />
        ) : (
          <WeekdayPill
            value={wdInputs[i]}
            onChange={v => patchWd(i, v)}
            correct={wdValid[i] && wdInputs[i] !== ''}
            wrong={wdInputs[i] !== '' && !wdValid[i]}
          />
        )}
      </div>
    )
    // Arrow row
    rows.push(
      <ArrowSection
        key={`arrow-${i}`}
        daysValue={answers[i].days}
        onDaysChange={v => patchAnswer(i, { days: v })}
        plusValue={answers[i].plus}
        onPlusChange={v => patchAnswer(i, { plus: v })}
        correctDays={segs[i].days}
        correctPlus={correctPlus[i]}
        direction={mode}
      />
    )
  }

  // Final row: last date + weekday
  const finalYearLabel = formatYearDate(parseDate(endDate).year, startD.month, startD.day)
  rows.push(
    <div key="date-final" className="flex items-center" style={{ gap: COL_GAP }}>
      <DateBox label={finalYearLabel} isFixed={true} />
      {mode === 'forward' ? (
        <WeekdayPill
          value={wdInputs[n - 1]}
          onChange={v => patchWd(n - 1, v)}
          correct={wdValid[n - 1] && wdInputs[n - 1] !== ''}
          wrong={wdInputs[n - 1] !== '' && !wdValid[n - 1]}
        />
      ) : (
        <WeekdayPill fixedLabel={WD[endWeekday!]} />
      )}
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Year chart */}
      <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-100 overflow-x-auto">
        <div className="flex flex-col py-6 px-8" style={{ width: 'max-content', margin: '0 auto' }}>
          {rows}
        </div>
      </div>

      {/* Status bar + reset */}
      <div
        className={['w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-300',
          allYearOk && !needsMonthTail
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            : allYearOk && needsMonthTail
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : hints.length
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-slate-100 text-slate-500 border border-slate-200'].join(' ')}
        style={{ fontFamily: FONT }}
      >
        <span className="flex-1">
          {allYearOk && !needsMonthTail
            ? mode === 'forward'
              ? `✓ 全部正确！${endDate.replace(/-/g, '')} 是 ${WD[correctWds[n]]}`
              : `✓ 全部正确！${startDate.replace(/-/g, '')} 是 ${WD[correctWds[0]]}`
            : allYearOk && needsMonthTail
            ? `✓ 跨年部分正确，${yearEndDate.replace(/-/g, '')} 是 ${WD[finalYearWd]}，继续完成跨月计算 ↓`
            : hints.length
            ? `✗ ${hints.slice(0, 2).join('；')}`
            : mode === 'forward'
              ? '填入每行天数（365/366）、余数（+N）、各节点星期（1–7）'
              : '已知终点星期，从下往上倒推：填入天数、余数（−N）、各节点星期（1–7）'}
        </span>
        <button
          onClick={reset}
          className="shrink-0 cursor-pointer rounded-full bg-white/50 px-2.5 py-0.5 text-[11px] font-medium hover:bg-white/80 transition-all active:scale-95"
          style={{ border: '1px solid rgba(0,0,0,0.12)', fontFamily: FONT }}
        >
          ↺ 重置
        </button>
      </div>

      {/* Cross-month tail — only when end date is NOT same month/day as start */}
      {needsMonthTail && (
        <div className="w-full mt-2">
          <MonthTail
            startDate={yearEndDate}
            endDate={endDate}
            startWeekday={
              mode === 'backward'
                ? finalYearWd  // backward: yearEndDate weekday is the fixed endWeekday prop
                : (wdInputs[n - 1] !== '' && +wdInputs[n - 1] >= 1 && +wdInputs[n - 1] <= 7
                    ? (+wdInputs[n - 1] as 1|2|3|4|5|6|7)
                    : finalYearWd)
            }
          />
        </div>
      )}
    </div>
  )
}

export default Year
