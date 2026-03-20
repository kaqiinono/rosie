'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ─────────────────────────── constants ────────────────────────────────────
const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SHORT = ['日', '一', '二', '三', '四', '五', '六']
const HEADS = ['一', '二', '三', '四', '五', '六', '日']
const MONTH_DAYS_NORMAL = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_DAYS_LEAP   = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const CONFETTI_COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#1DD1A1', '#A29BFE', '#FD79A8', '#FF9F43']
const DAY_BG = ['#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#1DD1A1', '#A29BFE', '#FD79A8']
const DAY_TEXT = ['#fff', '#fff', '#555', '#555', '#fff', '#fff', '#fff']

// ─────────────────────────── types ────────────────────────────────────────
interface ConfettiPiece { id: number; left: string; color: string; delay: string; dur: string; rot: number }
type TabId = 1 | 2 | 3 | 4 | 5 | 6

// ─────────────────────────── helpers ──────────────────────────────────────
let cid = 0
function mkConfetti(): ConfettiPiece[] {
  return Array.from({ length: 30 }, () => ({
    id: cid++,
    left: `${(Math.random() * 100).toFixed(1)}vw`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: `${(Math.random() * 0.6).toFixed(2)}s`,
    dur: `${(1 + Math.random()).toFixed(2)}s`,
    rot: Math.floor(Math.random() * 360),
  }))
}

function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }

/** Weekday display number: Mon=1..Sat=6, Sun=7 */
function dispNum(d: number) { return d === 0 ? 7 : d }

// ─────────────────────────── shared UI pieces ──────────────────────────────

function RunBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 rounded-full px-7 py-2.5 font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
      style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
    >
      {children}
    </button>
  )
}

function ResultBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 min-h-[60px] rounded-[18px] bg-white p-4 text-[1.05rem] leading-[1.8] text-gray-600 shadow-md">
      {children}
    </div>
  )
}

function DemoArea({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mt-5 rounded-[20px] border-2 border-dashed border-[#c8b4f8] p-5"
      style={{ background: 'linear-gradient(135deg,#f3eeff,#e8f5ff)' }}
    >
      <h3 className="mb-4 text-[1.1rem] font-bold text-[#5c3d9e]">{title}</h3>
      {children}
    </div>
  )
}

function ControlRow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-3">{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="min-w-[70px] text-sm text-gray-500">{children}</label>
}

function StyledSelect({ value, onChange, children, width = 120 }: {
  value: number | string; onChange: (v: string) => void; children: React.ReactNode; width?: number
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
      style={{ width }}
    >
      {children}
    </select>
  )
}

function StyledInput({ value, onChange, min, max, width = 110 }: {
  value: number; onChange: (v: number) => void; min: number; max: number; width?: number
}) {
  return (
    <input
      type="number" min={min} max={max}
      value={value}
      onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className="rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
      style={{ width }}
    />
  )
}

function StepNum({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
      style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
    >
      {children}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-[14px] border-2 border-[#ffd060] bg-[#fff9e6] p-3 text-sm leading-[1.7] text-[#7a5a00]">
      {children}
    </div>
  )
}

function ExplainBox({ variant = 'purple', children }: { variant?: 'purple' | 'green' | 'pink'; children: React.ReactNode }) {
  const styles = {
    purple: 'bg-[#f3eeff] border-[#c8b4f8] text-[#5c3d9e]',
    green:  'bg-[#efffef] border-[#7eebb0] text-[#1a7a4a]',
    pink:   'bg-[#fff0f8] border-[#f5a0d0] text-[#a03070]',
  }
  return (
    <div className={`flex-1 min-w-[130px] rounded-[14px] border-2 p-3 text-sm leading-[1.7] ${styles[variant]}`}>
      {children}
    </div>
  )
}

// Weekday formula output (both counting + fast)
function WeekdayFormula({ known, rem, target }: { known: number; rem: number; target: number }) {
  const dn = dispNum(known)
  const sum = dn + rem
  const needsMinus = sum > 7
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <div className="flex-1 min-w-[130px] rounded-[10px] border-2 border-[#b0d8ff] bg-[#e8f5ff] px-3 py-2 text-sm">
        🐌 <strong>数格子：</strong>{DAYS[known]} 往后数 {rem} 格 → <strong className="text-[#FF6B6B]">{DAYS[target]}</strong>
      </div>
      <div className="flex-1 min-w-[130px] rounded-[10px] border-2 border-[#ffcba0] bg-[#fff0e8] px-3 py-2 text-sm">
        ⚡ <strong>快速算：</strong>{dn} + {rem} = {needsMinus ? <>{sum} − 7 = <strong className="text-[#FF6B6B]">{sum - 7}</strong></> : <strong className="text-[#FF6B6B]">{sum}</strong>}{needsMinus ? ' (≥8减7)' : ''} → <strong className="text-[#FF6B6B]">{DAYS[target]}</strong>
      </div>
    </div>
  )
}

// Month grid
type CellVariant = 'empty' | 'normal' | 'hi1' | 'hi2' | 'hi3' | 'target' | 'sum-hi'
function MonthGrid({ cells }: { cells: { day: number | null; variant: CellVariant }[] }) {
  const bg: Record<CellVariant, string> = {
    empty: 'transparent', normal: '#f0f0f0', hi1: '#48DBFB', hi2: '#1DD1A1', hi3: '#A29BFE',
    target: '#FF6B6B', 'sum-hi': '#FECA57',
  }
  const col: Record<CellVariant, string> = {
    empty: '', normal: '#555', hi1: '#fff', hi2: '#fff', hi3: '#fff', target: '#fff', 'sum-hi': '#555',
  }
  return (
    <div className="my-3 grid grid-cols-7 gap-1.5">
      {HEADS.map(h => <div key={h} className="py-1 text-center text-[0.72rem] font-bold text-gray-300">{h}</div>)}
      {cells.map((c, i) => (
        <div
          key={i}
          className="flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-all duration-300"
          style={{
            background: bg[c.variant],
            color: col[c.variant],
            transform: c.variant === 'target' ? 'scale(1.1)' : undefined,
            fontWeight: c.variant === 'target' || c.variant === 'sum-hi' ? 'bold' : undefined,
          }}
        >
          {c.day}
        </div>
      ))}
    </div>
  )
}

// Ruler for Panel 1
function Ruler({ known, days }: { known: number; days: number }) {
  if (days === 0) return null
  const cells: { day: string; offset: number; type: 'known' | 'jump' | 'target' | 'dots' }[] = []
  if (days <= 13) {
    for (let i = 0; i <= days; i++) {
      cells.push({ day: SHORT[(known + i) % 7], offset: i, type: i === 0 ? 'known' : i === days ? 'target' : 'jump' })
    }
  } else {
    for (let i = 0; i <= 3; i++)
      cells.push({ day: SHORT[(known + i) % 7], offset: i, type: i === 0 ? 'known' : 'jump' })
    cells.push({ day: '…', offset: -1, type: 'dots' })
    for (let i = days - 3; i <= days; i++)
      cells.push({ day: SHORT[(known + i) % 7], offset: i, type: i === days ? 'target' : 'jump' })
  }
  const bgMap = { known: '#48DBFB', jump: '#FECA57', target: '#FF6B6B', dots: '#eee' }
  const clrMap = { known: '#fff', jump: '#555', target: '#fff', dots: '#aaa' }
  return (
    <div className="my-3 flex overflow-x-auto pb-1">
      {cells.map((c, i) => (
        <div
          key={i}
          className="flex min-w-[40px] flex-col items-center justify-center border-2 text-xs"
          style={{
            height: 44,
            background: bgMap[c.type], color: clrMap[c.type],
            borderColor: bgMap[c.type] === '#eee' ? '#ccc' : bgMap[c.type],
            borderRadius: i === 0 ? '10px 0 0 10px' : i === cells.length - 1 ? '0 10px 10px 0' : undefined,
            transform: c.type === 'target' ? 'scaleY(1.15)' : undefined,
          }}
        >
          <span className="font-bold text-[0.88rem]">{c.day}</span>
          {c.type !== 'dots' && <span className="opacity-70">{`+${c.offset}`}</span>}
        </div>
      ))}
    </div>
  )
}

// Month days chips
const MONTH_META = [
  { n: '1月',  days: 31,   type: 'big' as const,   emoji: '🏔️' },
  { n: '2月',  days: '28/29', type: 'feb' as const, emoji: '🌸' },
  { n: '3月',  days: 31,   type: 'big' as const,   emoji: '🌷' },
  { n: '4月',  days: 30,   type: 'small' as const, emoji: '🌧️' },
  { n: '5月',  days: 31,   type: 'big' as const,   emoji: '☀️' },
  { n: '6月',  days: 30,   type: 'small' as const, emoji: '🌊' },
  { n: '7月',  days: 31,   type: 'big' as const,   emoji: '🏖️' },
  { n: '8月',  days: 31,   type: 'big' as const,   emoji: '🌻' },
  { n: '9月',  days: 30,   type: 'small' as const, emoji: '🍂' },
  { n: '10月', days: 31,   type: 'big' as const,   emoji: '🎃' },
  { n: '11月', days: 30,   type: 'small' as const, emoji: '🍁' },
  { n: '12月', days: 31,   type: 'big' as const,   emoji: '❄️' },
]

function MonthChips() {
  return (
    <div className="my-3 flex flex-wrap gap-2">
      {MONTH_META.map(m => {
        const styles = {
          big:   'border-[#FF9F43] bg-[#fff8ee] text-[#b36000]',
          small: 'border-[#48DBFB] bg-[#eefbff] text-[#0080a0]',
          feb:   'border-[#FD79A8] bg-[#fff0f8] text-[#a0206a]',
        }
        return (
          <div key={m.n} className={`flex min-w-[72px] flex-col items-center rounded-[14px] border-2 px-3 py-2 ${styles[m.type]}`}>
            <span className="font-bold">{m.n}</span>
            <span className="mt-0.5 text-xs text-gray-400">{m.days}天 {m.emoji}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Panel 1 ──────────────────────────────────────
function Panel1({ onResult }: { onResult: (d: number) => void }) {
  const [known, setKnown] = useState(6)
  const [days, setDays] = useState(100)
  const [result, setResult] = useState<{ rem: number; target: number; weeks: number } | null>(null)
  const [showRuler, setShowRuler] = useState(false)

  const calc = useCallback(() => {
    const rem = days % 7
    const target = (known + days) % 7
    setResult({ rem, target, weeks: Math.floor(days / 7) })
    setShowRuler(true)
    onResult(target)
  }, [known, days, onResult])

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🗓️ 招式1 · 同月推算</h2>
      <p className="mb-5 text-sm leading-relaxed text-gray-400">在<strong>同一个月里</strong>，知道某天是星期几，推算同月另一天是星期几。</p>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <StepNum>1</StepNum>
          <div className="text-sm leading-[1.7] text-gray-700">
            用<strong className="text-[#6c4eb0]">大日期 − 小日期</strong>，算出两天相差几天
            <div className="mt-1 text-xs italic text-gray-400">例：2月25日 − 2月3日 = 相差22天</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <StepNum>2</StepNum>
          <div className="text-sm leading-[1.7] text-gray-700">
            把天数<strong className="text-[#6c4eb0]">÷ 7，只看余数</strong>
            <div className="mt-1 text-xs italic text-gray-400">22 ÷ 7 = 3周……余 1 天 → 关键是那个"1"！</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <StepNum>3</StepNum>
          <div className="flex-1 text-sm leading-[1.7] text-gray-700">
            用余数算出目标星期，有<strong className="text-[#6c4eb0]">两种方法都可以</strong>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="flex-1 min-w-[150px] rounded-xl border-2 border-[#b0d8ff] bg-[#e8f5ff] p-2 text-xs">
                🐌 <strong>方法一：往后数格子</strong><br />
                <span className="text-gray-400">从已知星期，一格一格往后数余数步</span>
              </div>
              <div className="flex-1 min-w-[150px] rounded-xl border-2 border-[#ffcba0] bg-[#fff0e8] p-2 text-xs">
                ⚡ <strong>方法二：直接算（更快！）</strong><br />
                <span className="text-gray-400">星期数字 + 余数，如果 ≥ 8 就再 − 7<br />周六=6，余3 → 6+3=9 → 9−7=2 → 周二 ✓</span>
              </div>
            </div>
            <div className="mt-1 text-xs italic text-gray-400">星期数字：周一=1，周二=2…周六=6，周日=7</div>
          </div>
        </div>
      </div>
      <Notice>
        💡 小秘密：<strong>每过7天，星期不变！</strong>就像走一圈回到原点。余数是几，就多走几步。<br />
        <strong>⚡ 快速公式：星期数字 + 余数，结果 ≥ 8 时减去 7</strong>，直接得到答案！
      </Notice>
      <DemoArea title="🎮 来试试！">
        <ControlRow>
          <Label>已知日期是</Label>
          <StyledSelect value={known} onChange={v => setKnown(Number(v))}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </StyledSelect>
        </ControlRow>
        <ControlRow>
          <Label>再过</Label>
          <StyledInput value={days} onChange={setDays} min={1} max={365} width={90} />
          <Label>天是？</Label>
        </ControlRow>
        <RunBtn onClick={calc}>✨ 算一算！</RunBtn>
        {showRuler && <Ruler known={known} days={days} />}
        {result ? (
          <ResultBubble>
            再过 <strong>{days}</strong> 天 ÷ 7 = {result.weeks}周 余 <strong>{result.rem}</strong> 天
            <WeekdayFormula known={known} rem={result.rem} target={result.target} />
          </ResultBubble>
        ) : <ResultBubble><span className="text-gray-400">点上面的按钮开始！</span></ResultBubble>}
      </DemoArea>
    </div>
  )
}

// ─────────────────────────── Panel 2 ──────────────────────────────────────
function Panel2({ onResult }: { onResult: (d: number) => void }) {
  const [m1, setM1] = useState(4); const [d1, setD1] = useState(4)
  const [m2, setM2] = useState(6); const [d2, setD2] = useState(23)
  const [known, setKnown] = useState(6)
  const [leap, setLeap] = useState(0)
  const [result, setResult] = useState<React.ReactNode | null>(null)

  const calc = useCallback(() => {
    const mdays = leap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL
    if (m2 < m1 || (m2 === m1 && d2 <= d1)) {
      setResult(<span className="text-yellow-600">⚠️ 目标日期要在起始日期之后哦！</span>)
      return
    }
    let total = 0
    const segs: React.ReactNode[] = []
    if (m1 === m2) {
      const diff = d2 - d1
      total = diff
      segs.push(<div key="s" className="my-1 rounded-lg border-2 border-[#7eeab0] bg-[#e8fff4] px-3 py-2 text-sm">🔵 同月相差：{d2} − {d1} = <strong>{diff}天</strong></div>)
    } else {
      const rem1 = mdays[m1] - d1; total += rem1
      segs.push(<div key="s1" className="my-1 rounded-lg border-2 border-[#ffb0b0] bg-[#ffe8e8] px-3 py-2 text-sm">🚩 <strong>起始月（{m1}月）</strong>：{mdays[m1]} − {d1} = <strong className="text-red-600">{rem1}天</strong></div>)
      const mids = []
      for (let m = m1 + 1; m < m2; m++) { mids.push({ m, days: mdays[m] }); total += mdays[m] }
      if (mids.length > 0) {
        const midSum = mids.reduce((s, x) => s + x.days, 0)
        segs.push(<div key="s2" className="my-1 rounded-lg border-2 border-[#b0d8ff] bg-[#e8f5ff] px-3 py-2 text-sm">🔵 <strong>中间月</strong>：{mids.map(x => `${x.m}月(${x.days}天)`).join('、')}，合计 <strong className="text-blue-700">{midSum}天</strong></div>)
      }
      total += d2
      segs.push(<div key="s3" className="my-1 rounded-lg border-2 border-[#7eeab0] bg-[#e8fff4] px-3 py-2 text-sm">🏁 <strong>结束月（{m2}月）</strong>：目标日数字 = <strong className="text-green-700">{d2}天</strong></div>)
    }
    const rem = total % 7; const target = (known + rem) % 7
    setResult(<>
      <div className="mb-2">{segs}</div>
      <div className="mb-2 rounded-lg border-2 border-[#d0c0f8] bg-[#f8f4ff] px-3 py-2 text-sm">📦 三段合计 = <strong>{total}</strong> 天 ÷ 7 = {Math.floor(total / 7)}周 余 <strong>{rem}</strong> 天</div>
      <WeekdayFormula known={known} rem={rem} target={target} />
    </>)
    onResult(target)
  }, [m1, d1, m2, d2, known, leap, onResult])

  const monthOpts = Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}月</option>)

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">📅 招式2 · 跨月推算</h2>
      <p className="mb-5 text-sm leading-relaxed text-gray-400">在<strong>同一年里</strong>，跨越不同月份推算星期几。需要一个一个月地数天数！</p>
      <div className="flex items-start gap-3 mb-3">
        <StepNum>🗝️</StepNum>
        <div className="text-sm leading-[1.7] text-gray-700">跨月的天数要分<strong className="text-[#6c4eb0]">三段</strong>来数，每段的算法都不一样！</div>
      </div>
      {/* Three-segment visual */}
      <div className="my-3 rounded-[18px] border-2 border-[#d8c8ff] bg-[#f8f4ff] p-4">
        <div className="mb-3 font-bold text-[#5c3d9e]">📐 三段计算法（以 4月4日 → 6月23日 为例）</div>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[130px] rounded-[14px] border-2 border-[#ffb0b0] bg-[#ffe8e8] p-3 text-xs leading-[1.9]">
            <div className="mb-1 font-bold text-red-600">🚩 第①段：起始月</div>
            <strong>特殊规则：</strong>该月总天数 − 当前日 = 剩余天数<br />
            <span className="rounded bg-[#ffe0e0] px-1 font-bold text-red-600">4月(30天) − 4日 = 26天</span>
          </div>
          <div className="flex items-center text-2xl text-[#a29bfe] px-1">+</div>
          <div className="flex-1 min-w-[130px] rounded-[14px] border-2 border-[#b0d8ff] bg-[#e8f5ff] p-3 text-xs leading-[1.9]">
            <div className="mb-1 font-bold text-blue-600">🔵 第②段：中间月</div>
            <strong>整个月都算进去：</strong>直接用该月的<strong>总天数</strong><br />
            <span className="rounded bg-[#ddeeff] px-1 font-bold text-blue-700">5月 = 31天</span>
          </div>
          <div className="flex items-center text-2xl text-[#a29bfe] px-1">+</div>
          <div className="flex-1 min-w-[130px] rounded-[14px] border-2 border-[#7eeab0] bg-[#e8fff4] p-3 text-xs leading-[1.9]">
            <div className="mb-1 font-bold text-green-700">🏁 第③段：结束月</div>
            <strong>特殊规则：</strong>直接用<strong>目标日的数字</strong><br />
            <span className="rounded bg-[#d8ffee] px-1 font-bold text-green-700">6月23日 → 23天</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl border-2 border-[#d8c8ff] bg-white p-2 text-center text-sm text-[#5c3d9e]">
          总天数 = <strong>26</strong>（起始月）＋ <strong>31</strong>（5月）＋ <strong>23</strong>（结束月）= <strong className="text-xl text-[#FF6B6B]">80天</strong>
        </div>
      </div>
      <div className="mb-2 font-bold text-[#5c3d9e]">📋 各月天数口诀表：</div>
      <MonthChips />
      <Notice>
        🧠 大月口诀：<strong>1、3、5、7、8、10、12月 → 31天</strong><br />
        小月口诀：<strong>4、6、9、11月 → 30天</strong><br />
        2月很特别：平年28天，闰年29天 🐸
      </Notice>
      <DemoArea title="🎮 来试试！（同年跨月）">
        <ControlRow>
          <Label>起始月</Label>
          <StyledSelect value={m1} onChange={v => setM1(Number(v))} width={80}>{monthOpts}</StyledSelect>
          <StyledInput value={d1} onChange={setD1} min={1} max={31} width={70} />
          <Label>日 是</Label>
          <StyledSelect value={known} onChange={v => setKnown(Number(v))}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </StyledSelect>
        </ControlRow>
        <ControlRow>
          <Label>目标月</Label>
          <StyledSelect value={m2} onChange={v => setM2(Number(v))} width={80}>{monthOpts}</StyledSelect>
          <StyledInput value={d2} onChange={setD2} min={1} max={31} width={70} />
          <Label>日 是？</Label>
        </ControlRow>
        <ControlRow>
          <Label>是否闰年</Label>
          <StyledSelect value={leap} onChange={v => setLeap(Number(v))} width={100}>
            <option value={0}>平年</option><option value={1}>闰年</option>
          </StyledSelect>
        </ControlRow>
        <RunBtn onClick={calc}>✨ 算一算！</RunBtn>
        <ResultBubble>{result ?? <span className="text-gray-400">点上面的按钮开始！</span>}</ResultBubble>
      </DemoArea>
    </div>
  )
}

// ─────────────────────────── Panel 3 ──────────────────────────────────────
const YEAR_TIMELINE = [
  { year: 2023, day: 0 }, { year: 2024, day: 1 }, { year: 2025, day: 3 }, { year: 2026, day: 4 },
]

function Panel3({ onResult }: { onResult: (d: number) => void }) {
  const [targetYear, setTargetYear] = useState(2026)
  const [result, setResult] = useState<React.ReactNode | null>(null)

  const calc = useCallback(() => {
    let day = 0; let year = 2023
    const steps: string[] = []; const shifts: number[] = []
    while (year < targetYear) {
      const lp = isLeap(year); const shift = lp ? 2 : 1
      steps.push(`${year}${lp ? '🐸闰' : '🌱平'}+${shift}`)
      shifts.push(shift); day = (day + shift) % 7; year++
    }
    const totalShift = shifts.reduce((a, b) => a + b, 0)
    const rem = totalShift % 7
    setResult(<>
      <div className="flex flex-wrap gap-1 mb-2">
        {steps.map((s, i) => <span key={i} className="text-xs text-gray-400">{s}{i < steps.length - 1 ? ' → ' : ''}</span>)}
      </div>
      累计偏移：{shifts.join('+')} = <strong>{totalShift}</strong>，余 <strong>{rem}</strong> 天
      <WeekdayFormula known={0} rem={rem} target={day} />
      <div className="mt-2 text-center text-2xl font-bold text-[#FF6B6B]">{DAYS[day]} 🎉</div>
    </>)
    onResult(day)
  }, [targetYear, onResult])

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🌍 招式3 · 跨年推算（同月同日）</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">从一年的某日，推算<strong>若干年后同月同日</strong>是星期几。平年+1，闰年+2。</p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <ExplainBox>🌱 <strong>平年</strong>：365天<br />365 ÷ 7 = 52周 <strong>余1</strong><br />明年同一天<strong>往后移1格</strong></ExplainBox>
        <div className="text-3xl" style={{ animation: 'arrowBounce 1s ease-in-out infinite' }}>➡️</div>
        <ExplainBox variant="green">🐸 <strong>闰年</strong>：366天<br />366 ÷ 7 = 52周 <strong>余2</strong><br />明年同一天<strong>往后移2格</strong></ExplainBox>
      </div>
      <Notice>
        🐸 <strong>怎么判断闰年？</strong><br />
        ① 年份末两位 ÷ 4 整除 → 闰年（如 2024：24÷4=6 ✓）<br />
        ② 末两位是00时，用前两位 ÷ 4（如 2000：20÷4=5 ✓ 是闰年）
      </Notice>
      {/* Year timeline */}
      <div className="my-4 flex flex-wrap justify-center gap-3">
        {YEAR_TIMELINE.map((item, i) => (
          <div key={item.year} className="flex items-center gap-3">
            <div className="rounded-[18px] border-2 border-[#c8b4f8] bg-[#f3eeff] px-4 py-3 text-center">
              <div className="text-xs text-gray-400">{item.year}年1月1日</div>
              <div className="my-1 text-3xl font-bold text-[#6c4eb0]">{SHORT[item.day]}</div>
              <div className="text-xs text-[#5c3d9e]">{DAYS[item.day]}{i === 0 ? ' 🌟起点' : ''}</div>
            </div>
            {i < YEAR_TIMELINE.length - 1 && (
              <div className="flex flex-col items-center text-xs text-gray-400">
                <span className="text-2xl text-[#a29bfe]" style={{ animation: 'arrowBounce 1.2s ease-in-out infinite' }}>→</span>
                <span>{isLeap(item.year) ? '闰年+2' : '平年+1'}</span>
                <span>{item.year}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <DemoArea title="🎮 来试试！（从2023年1月1日=周日出发）">
        <ControlRow>
          <Label>目标年份</Label>
          <StyledInput value={targetYear} onChange={setTargetYear} min={2023} max={2040} width={100} />
          <Label>年1月1日是？</Label>
        </ControlRow>
        <RunBtn onClick={calc}>✨ 算一算！</RunBtn>
        <ResultBubble>{result ?? <span className="text-gray-400">点上面的按钮开始！</span>}</ResultBubble>
      </DemoArea>
    </div>
  )
}

// ─────────────────────────── Panel 4 ──────────────────────────────────────
function Panel4() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🚀 招式4 · 跨年跨月（终极两步走）</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">目标年份和月日都不同？不慌！分<strong>两步走</strong>：先跨年，再跨月。</p>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <StepNum>①</StepNum>
          <div className="text-sm leading-[1.7] text-gray-700">
            <strong className="text-[#6c4eb0]">第一步：先用招式3</strong>，推算到目标年的同月同日是星期几
            <div className="mt-1 text-xs italic text-gray-400">如：2021年3月18日（周六）→ 逐年推到 2026年3月18日</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <StepNum>②</StepNum>
          <div className="text-sm leading-[1.7] text-gray-700">
            <strong className="text-[#6c4eb0]">第二步：再用招式2</strong>，从同月同日推算到目标日期
            <div className="mt-1 text-xs italic text-gray-400">2026年3月18日 → 再计算到 2026年9月5日，经过多少天，÷7取余</div>
          </div>
        </div>
      </div>
      <Notice>🪄 口诀记住：<strong>先过年，再过月！</strong><br />就像旅行：先坐飞机飞到目标城市（跨年），再打车到目的地（跨月）。</Notice>
      {/* Step visual */}
      <div className="my-4 flex flex-wrap items-center gap-3">
        <ExplainBox>📅 起始日<br /><strong>某年某月某日</strong></ExplainBox>
        <div className="text-center text-xs text-[#a29bfe]"><div className="text-2xl">→</div><div>招式3</div><div>逐年推</div></div>
        <ExplainBox variant="green">🌍 目标年<br /><strong>同月同日</strong></ExplainBox>
        <div className="text-center text-xs text-[#a29bfe]"><div className="text-2xl">→</div><div>招式2</div><div>跨月推</div></div>
        <ExplainBox variant="pink">🎯 目标日<br /><strong>答案！</strong></ExplainBox>
      </div>
      {/* Fixed worked example */}
      <div className="rounded-2xl border-2 border-dashed border-[#c8b4f8] p-5" style={{ background: 'linear-gradient(135deg,#f3eeff,#e8f5ff)' }}>
        <h3 className="mb-3 font-bold text-[#5c3d9e]">🎮 分步演算器（2021.3.18 周六 → 2026.9.5）</h3>
        <p className="mb-3 text-sm text-gray-400">跟着两步，一步一步来算！</p>
        <div className="mb-3 rounded-[14px] bg-[#f3eeff] p-3 text-sm leading-[2]">
          <div className="mb-2 font-bold text-[#6c4eb0]">第①步：2021→2026，同月同日</div>
          2021平年+1 → 2022平年+1 → 2023平年+1 → 2024闰年+2 → 2025平年+1<br />
          累计偏移：1+1+1+2+1 = <strong className="text-[#FF6B6B]">6格</strong>，余6天<br />
          🐌 数格子：周六往后数6格 → 周五<br />
          ⚡ 快速算：6（周六）+ 6 = 12，12 ≥ 8，12 − 7 = <strong className="text-[#FF6B6B]">5 → 周五</strong> ✓
        </div>
        <div className="rounded-[14px] bg-[#efffef] p-3 text-sm leading-[2]">
          <div className="mb-2 font-bold text-green-700">第②步：2026.3.18 周五 → 2026.9.5</div>
          3月：31-18=13天，4月30天，5月31天，6月30天，7月31天，8月31天，9月1~5日5天<br />
          合计：13+30+31+30+31+31+5 = <strong className="text-[#FF6B6B]">171天</strong><br />
          171 ÷ 7 = 24周……余 <strong className="text-[#FF6B6B]">3天</strong><br />
          🐌 数格子：周五往后数3格 → 五→六→日→<strong className="text-[#FF6B6B]">一</strong><br />
          ⚡ 快速算：5（周五）+ 3 = 8，8 ≥ 8，8 − 7 = <strong className="text-[#FF6B6B]">1 → 周一</strong> ✓
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Panel 5 ──────────────────────────────────────
function Panel5({ onResult }: { onResult: (d: number) => void }) {
  const [totalDays, setTotalDays] = useState(31)
  const [startDay, setStartDay] = useState(3)
  const [targetDay, setTargetDay] = useState(31)
  const [cells, setCells] = useState<{ day: number | null; variant: CellVariant }[]>([])
  const [legend, setLegend] = useState<React.ReactNode>(null)
  const [result, setResult] = useState<React.ReactNode | null>(null)

  const build = useCallback(() => {
    if (targetDay > totalDays) {
      setResult(<span className="text-yellow-600">⚠️ 这个月只有{totalDays}天，没有第{targetDay}日哦！</span>)
      return
    }
    const offset = startDay === 0 ? 6 : startDay - 1
    const rem = totalDays % 7
    const fiveDow: number[] = []
    for (let i = 0; i < rem; i++) fiveDow.push((startDay + i) % 7)
    const targetDow = (startDay + targetDay - 1) % 7
    const colorVariants: CellVariant[] = ['hi1', 'hi2', 'hi3']

    const newCells: { day: number | null; variant: CellVariant }[] = [
      ...Array(offset).fill({ day: null, variant: 'empty' as CellVariant }),
      ...Array(totalDays).fill(null).map((_, i) => {
        const d = i + 1
        const dow = (startDay + i) % 7
        let variant: CellVariant = 'normal'
        if (d === targetDay) variant = 'target'
        else { const fi = fiveDow.indexOf(dow); if (fi >= 0 && colorVariants[fi]) variant = colorVariants[fi] }
        return { day: d, variant }
      }),
    ]
    setCells(newCells)

    const tagColors: Record<CellVariant, string> = { hi1: '#48DBFB', hi2: '#1DD1A1', hi3: '#A29BFE', target: '#FF6B6B', empty: '', normal: '', 'sum-hi': '' }
    setLegend(
      <div className="my-2 flex flex-wrap gap-2">
        {fiveDow.map((dow, i) => colorVariants[i] && (
          <span key={i} className="rounded-lg px-3 py-1 text-xs font-bold text-white" style={{ background: tagColors[colorVariants[i]] }}>{DAYS[dow]}（5次）</span>
        ))}
        <span className="rounded-lg px-3 py-1 text-xs font-bold text-white" style={{ background: '#FF6B6B' }}>第{targetDay}日（目标）</span>
      </div>
    )

    const stepRem = (targetDay - 1) % 7
    setResult(<>
      {totalDays} ÷ 7 = {Math.floor(totalDays / 7)}周 余 <strong>{rem}</strong> 天，所以 <strong>{rem}</strong> 个星期各出现5次<br />
      1号是{DAYS[startDay]}，第{targetDay}日：({targetDay}-1) ÷ 7 余 <strong>{stepRem}</strong>
      <WeekdayFormula known={startDay} rem={stepRem} target={targetDow} />
    </>)
    onResult(targetDow)
  }, [totalDays, startDay, targetDay, onResult])

  useEffect(() => { build() }, []) // eslint-disable-line

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🔍 招式5 · 确定星期几</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">知道某星期出现了几次（多少次），反过来推算1号是星期几，再算目标日！</p>
      <div className="space-y-4 mb-3">
        {[
          { num: '💡', t: '一个月的天数 ÷ 7，算出', b: '余数是几', eg: '31天 ÷ 7 = 4周余3天 → 有3个星期各出现5次，其余出现4次' },
          { num: '🧩', t: '出现', b: '5次的星期', extra: '，一定是从1号开始连续排的那几个', eg: '如果周三、周四、周五各5次，说明1号就是周三！' },
          { num: '🎯', t: '确定1号后，用', b: '目标日期 ÷ 7取余', extra: '，从1号往后数余数格', eg: '求18日：从1号（周三）数 (18-1)÷7=2周余3 → 往后3格 = 周六' },
        ].map(s => (
          <div key={s.num} className="flex items-start gap-3">
            <StepNum>{s.num}</StepNum>
            <div className="text-sm leading-[1.7] text-gray-700">
              {s.t}<strong className="text-[#6c4eb0]">{s.b}</strong>{s.extra ?? ''}
              <div className="mt-1 text-xs italic text-gray-400">{s.eg}</div>
            </div>
          </div>
        ))}
      </div>
      <Notice>
        📊 <strong>不同月份的规律：</strong><br />
        28天月 → 余0，每个星期恰好各4次，无多余<br />
        29天月 → 余1，有<strong>1</strong>个星期出现5次<br />
        30天月 → 余2，有<strong>2</strong>个星期出现5次<br />
        31天月 → 余3，有<strong>3</strong>个星期出现5次
      </Notice>
      <DemoArea title="🎮 来试试！">
        <ControlRow>
          <Label>这个月有</Label>
          <StyledSelect value={totalDays} onChange={v => setTotalDays(Number(v))} width={100}>
            {[28, 29, 30, 31].map(n => <option key={n} value={n}>{n}天</option>)}
          </StyledSelect>
        </ControlRow>
        <ControlRow>
          <Label>1号是</Label>
          <StyledSelect value={startDay} onChange={v => setStartDay(Number(v))}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </StyledSelect>
        </ControlRow>
        <ControlRow>
          <Label>求第</Label>
          <StyledInput value={targetDay} onChange={setTargetDay} min={1} max={31} width={70} />
          <Label>日是星期几</Label>
        </ControlRow>
        <RunBtn onClick={build}>✨ 画出来！</RunBtn>
        {cells.length > 0 && <MonthGrid cells={cells} />}
        {legend}
        <ResultBubble>{result ?? <span className="text-gray-400">点上面的按钮开始！</span>}</ResultBubble>
      </DemoArea>
    </div>
  )
}

// ─────────────────────────── Panel 6 ──────────────────────────────────────
interface Case6Result {
  valid: boolean
  shift: number | null
  dates: number[]
  ok: boolean
  outOfRange: boolean
}

function calcCase(sum: number, totalDays: number, n: 4 | 5): Case6Result {
  const base = n === 4 ? [1, 8, 15, 22] : [1, 8, 15, 22, 29]
  const minSum = base.reduce((a, b) => a + b, 0)
  const diff = sum - minSum
  const ok = diff >= 0 && diff % n === 0
  const shift = ok ? diff / n : null
  const dates = base.map(d => d + (ok && shift !== null ? shift : 0))
  const outOfRange = ok && (shift! > 6 || dates[n - 1] > totalDays)
  return { valid: ok && !outOfRange, shift, dates, ok, outOfRange }
}

function Panel6({ onResult }: { onResult: (d: number) => void }) {
  const [totalDays, setTotalDays] = useState(31)
  const [sum, setSum] = useState(80)
  const [computed, setComputed] = useState(false)
  const [case4, setCase4] = useState<Case6Result | null>(null)
  const [case5, setCase5] = useState<Case6Result | null>(null)
  const [cells, setCells] = useState<{ day: number | null; variant: CellVariant }[]>([])
  const [finalResult, setFinalResult] = useState<React.ReactNode>(null)

  const calc = useCallback(() => {
    const c4 = calcCase(sum, totalDays, 4)
    const c5 = calcCase(sum, totalDays, 5)
    setCase4(c4); setCase5(c5); setComputed(true)

    const winner = c4.valid ? c4 : c5.valid ? c5 : null
    if (winner) {
      const winDates = winner.dates
      const newCells: { day: number | null; variant: CellVariant }[] = Array.from({ length: totalDays }, (_, i) => {
        const d = i + 1
        let variant: CellVariant = 'normal'
        if (winDates.includes(d)) variant = d === winDates[winDates.length - 1] ? 'target' : 'sum-hi'
        return { day: d, variant }
      })
      setCells(newCells)
      const winCount = c4.valid ? 4 : 5
      const lastDay = winDates[winDates.length - 1]
      setFinalResult(<>
        这个月星期X共出现 <strong>{winCount}次</strong>，日期是：<strong>{winDates.join('、')}</strong> 号<br />
        第一个是 <strong>{winDates[0]}号</strong>，最后一个是 <strong className="text-2xl text-[#FF6B6B]">{lastDay}号</strong> 🎉
      </>)
      onResult(0)
    } else {
      setCells([])
      setFinalResult(<span className="text-yellow-600">⚠️ 这个总和两种情况都不对，请检查一下输入哦！</span>)
    }
  }, [sum, totalDays, onResult])

  const base4s = [1, 8, 15, 22]; const base5s = [1, 8, 15, 22, 29]
  const minSum4 = 46; const minSum5 = 75

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🔢 招式6 · 日期总和反推</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">知道某月<strong>所有星期X的日期加起来等于多少</strong>，反推出是哪几号！</p>
      <div className="space-y-3 mb-3">
        {[
          { n: '🤔', b: '先想一想：这个星期出现几次？', body: <>只有两种可能：<strong className="text-[#6c4eb0]">4次</strong> 或者 <strong className="text-[#6c4eb0]">5次</strong>！<div className="text-xs italic text-gray-400 mt-1">（一个月只有28~31天，每7天一轮回，不可能出现6次）</div></> },
          { n: '🎲', b: '先试试 4次 的情况：', body: <>假设1号是星期X，就会是：1号、8号、15号、22号 → 加起来 = <strong>46</strong><br />假设7号是星期X，就会是：7号、14号、21号、28号 → 加起来 = <strong>70</strong><div className="text-xs italic text-gray-400 mt-1">所以4次时，总和必须在 46～70 之间</div></> },
          { n: '🔧', b: '用"差值平均分"找到第一个：', body: <>把题目给的总和，减去"如果1号是星期X"的总和（46）<br />差值 ÷ 4 = 偏移几天 → 第一个 = 1 + 偏移天数<div className="text-xs italic text-gray-400 mt-1">总和=80：80−46=34，34÷4=8½ → 不整除，说明不是4次！</div></> },
          { n: '✅', b: '再试试 5次 的情况（方法一样）：', body: <>5次时最小总和：1+8+15+22+29 = <strong>75</strong><br />差值 ÷ 5 能整除 且 结果是整数 → 就找到答案了！<div className="text-xs italic text-gray-400 mt-1">总和=80：80−75=5，5÷5=1 → 第一个是 1+1=2号 ✓</div></> },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <StepNum>{s.n}</StepNum>
            <div className="text-sm leading-[1.7] text-gray-700"><strong className="text-[#6c4eb0]">{s.b}</strong><br />{s.body}</div>
          </div>
        ))}
      </div>
      <Notice>
        🌟 <strong>超简单口诀：</strong><br />
        ① 先算"从1号开始"时的最小总和<br />
        ② 用给定总和减去最小总和 = 差值<br />
        ③ 差值 ÷ 次数 能整除 → 答案 = 1 + 商<br />
        ④ 两种次数（4次/5次）都试一遍，哪个合理选哪个！
      </Notice>
      <DemoArea title="🎮 一步步推给你看！">
        <ControlRow>
          <Label>这个月有</Label>
          <StyledSelect value={totalDays} onChange={v => setTotalDays(Number(v))} width={100}>
            {[28, 29, 30, 31].map(n => <option key={n} value={n}>{n}天</option>)}
          </StyledSelect>
        </ControlRow>
        <ControlRow>
          <Label>日期总和是</Label>
          <StyledInput value={sum} onChange={setSum} min={10} max={200} width={90} />
        </ControlRow>
        <RunBtn onClick={calc}>🔍 一步步推算！</RunBtn>

        {computed && case4 && case5 && (
          <div className="mt-4 space-y-3">
            {/* Case 4 */}
            <div className="rounded-2xl border-2 border-[#ffd060] bg-[#fff8ee] p-4">
              <div className="mb-2 font-bold text-[#a06000]">🎲 先试试：这个星期出现 <span className="rounded-lg bg-[#FF9F43] px-2 py-0.5 text-sm text-white">4次</span> 的情况</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
                如果1号是星期X，4次就是：
                {base4s.map((d, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#FECA57] font-bold text-[#555] shadow">{d}</span>
                    {i < base4s.length - 1 && <span>+</span>}
                  </span>
                ))}
                <span className="ml-1">= {minSum4}</span>
              </div>
              <div className="mb-2 text-sm leading-[2] text-gray-600">
                最小总和 = <strong>{minSum4}</strong>，题目总和 = <strong>{sum}</strong>，差值 = {sum} − {minSum4} = <strong>{sum - minSum4}</strong><br />
                差值 ÷ 4 = {sum - minSum4} ÷ 4 = <strong style={{ color: case4.ok ? '#1D7A4A' : '#e53' }}>{case4.ok ? `${case4.shift!}（整除✓）` : `${((sum - minSum4) / 4).toFixed(1)}（不整除✗）`}</strong>
                {case4.ok && <><br />所以每个日期都往后移 <strong>{case4.shift}</strong> 天：{case4.dates.join(' + ')} = <strong>{sum}</strong></>}
              </div>
              {case4.valid
                ? <div className="rounded-[10px] border-2 border-[#7eebb0] bg-[#efffef] px-3 py-2 text-sm text-green-700">✅ 4次可行！第一个是 <strong>{case4.dates[0]}号</strong>，最后一个是 <strong>{case4.dates[3]}号</strong></div>
                : <div className="rounded-[10px] border-2 border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-sm text-red-600">❌ 4次不行，{case4.ok ? `算出来 ${case4.dates[3]}号 超过月底了！` : '差值不能被4整除。'} 换5次试试！</div>
              }
            </div>
            {/* Case 5 */}
            <div className="rounded-2xl border-2 border-[#7eebb0] bg-[#f0fff8] p-4">
              <div className="mb-2 font-bold text-[#1a6040]">🎲 再试试：这个星期出现 <span className="rounded-lg bg-[#1DD1A1] px-2 py-0.5 text-sm text-white">5次</span> 的情况</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
                如果1号是星期X，5次就是：
                {base5s.map((d, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#1DD1A1] font-bold text-white shadow">{d}</span>
                    {i < base5s.length - 1 && <span>+</span>}
                  </span>
                ))}
                <span className="ml-1">= {minSum5}</span>
              </div>
              <div className="mb-2 text-sm leading-[2] text-gray-600">
                最小总和 = <strong>{minSum5}</strong>，题目总和 = <strong>{sum}</strong>，差值 = {sum} − {minSum5} = <strong>{sum - minSum5}</strong><br />
                差值 ÷ 5 = {sum - minSum5} ÷ 5 = <strong style={{ color: case5.ok ? '#1D7A4A' : '#e53' }}>{case5.ok ? `${case5.shift!}（整除✓）` : `${((sum - minSum5) / 5).toFixed(1)}（不整除✗）`}</strong>
                {case5.ok && <><br />所以每个日期都往后移 <strong>{case5.shift}</strong> 天：{case5.dates.join(' + ')} = <strong>{sum}</strong></>}
              </div>
              {case5.valid
                ? <div className="rounded-[10px] border-2 border-[#7eebb0] bg-[#efffef] px-3 py-2 text-sm text-green-700">✅ 5次可行！第一个是 <strong>{case5.dates[0]}号</strong>，最后一个是 <strong>{case5.dates[4]}号</strong></div>
                : <div className="rounded-[10px] border-2 border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-sm text-red-600">❌ 5次也不行，{case5.ok ? `${case5.dates[4]}号 超过月底了！` : '差值不能被5整除。'} 请检查输入！</div>
              }
            </div>
            {/* Final calendar */}
            {cells.length > 0 && (
              <div>
                <div className="my-2 font-bold text-[#5c3d9e]">📅 找到啦！在日历上画出来：</div>
                <MonthGrid cells={cells} />
                <div className="flex flex-wrap gap-2 my-2">
                  <span className="rounded-lg bg-[#FECA57] px-3 py-1 text-xs font-bold text-[#555]">🟡 星期X（出现的日期）</span>
                  <span className="rounded-lg bg-[#FF6B6B] px-3 py-1 text-xs font-bold text-white">🔴 最后一个日期</span>
                </div>
                <ResultBubble>{finalResult}</ResultBubble>
              </div>
            )}
            {cells.length === 0 && finalResult && <ResultBubble>{finalResult}</ResultBubble>}
          </div>
        )}
        {!computed && <ResultBubble><span className="text-gray-400">点上面的按钮开始推算！</span></ResultBubble>}
      </DemoArea>
    </div>
  )
}

// ─────────────────────────── WeekStrip ────────────────────────────────────
function WeekStrip({ highlighted }: { highlighted: number | null }) {
  // Chips order: Mon(1)..Sat(6), Sun(0)
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 py-4">
      {order.map((dayVal, i) => {
        const isHl = highlighted !== null && ((highlighted % 7 + 7) % 7) === dayVal
        return (
          <div
            key={dayVal}
            className="flex cursor-pointer select-none items-center justify-center rounded-full border-[3px] border-white/60 font-bold shadow-lg transition-all duration-300 hover:scale-110 hover:-rotate-6"
            style={{ width: 52, height: 52, background: DAY_BG[i], color: DAY_TEXT[i], fontSize: '1rem', transform: isHl ? 'scale(1.3)' : undefined, boxShadow: isHl ? '0 0 0 5px gold, 0 4px 20px rgba(0,0,0,0.3)' : undefined }}
          >
            {SHORT[dayVal]}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Confetti ─────────────────────────────────────
function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute h-3.5 w-2.5 rounded-sm opacity-0"
          style={{ left: p.left, top: '-20px', background: p.color, transform: `rotate(${p.rot}deg)`, animationName: 'confettiFall', animationDuration: p.dur, animationDelay: p.delay, animationFillMode: 'forwards', animationTimingFunction: 'ease-out' }} />
      ))}
    </div>
  )
}

// ─────────────────────────── Root component ───────────────────────────────
export default function WeekdayMagic() {
  const [activeTab, setActiveTab] = useState<TabId>(1)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleResult = useCallback((day: number) => {
    setHighlighted(day)
    if (hlTimer.current) clearTimeout(hlTimer.current)
    hlTimer.current = setTimeout(() => setHighlighted(null), 2500)
    setConfetti(mkConfetti())
    setTimeout(() => setConfetti([]), 2600)
  }, [])

  const tabs: { id: TabId; label: string; bg: string; color: string }[] = [
    { id: 1, label: '🗓️ 招式1\n同月推算',   bg: '#c8e6ff', color: '#2d6da3' },
    { id: 2, label: '📅 招式2\n跨月推算',   bg: '#ffd6e8', color: '#a33080' },
    { id: 3, label: '🌍 招式3\n跨年同日',   bg: '#c8f5d8', color: '#1d7a4a' },
    { id: 4, label: '🚀 招式4\n跨年跨月',   bg: '#fff0c8', color: '#8a6a00' },
    { id: 5, label: '🔍 招式5\n确定星期',   bg: '#e8d8ff', color: '#6030a0' },
    { id: 6, label: '🔢 招式6\n日期求和',   bg: '#ffd8c8', color: '#a04020' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap');
        .wm-root { font-family: 'ZCOOL XiaoWei', 'PingFang SC', sans-serif; }
        @keyframes bounceY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes arrowBounce { 0%,100%{transform:translateX(0)} 50%{transform:translateX(6px)} }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .panel-anim { animation: fadeInUp 0.4s ease; }
      `}</style>
      <div className="wm-root min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(180deg,#a8edea 0%,#fed6e3 100%)' }}>
        <Confetti pieces={confetti} />

        {/* Hero */}
        <div className="px-4 pb-3 pt-7 text-center">
          <h1 className="font-extrabold text-[#6c4eb0]"
            style={{ fontSize: 'clamp(2rem,6vw,3.2rem)', textShadow: '3px 3px 0 #e8c0ff, 0 0 20px rgba(255,255,255,0.8)', animation: 'bounceY 2s ease-in-out infinite' }}>
            🌈 星期魔法书 ✨
          </h1>
          <p className="mt-1.5 text-lg text-[#7c5cbf]">知道今天是星期几，就能算出任何一天！共 6 种魔法招式 🪄</p>
        </div>

        <WeekStrip highlighted={highlighted} />

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 px-3 pb-2 pt-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="whitespace-pre-line rounded-full px-4 py-2 text-center text-sm font-bold shadow-md transition-all duration-200"
              style={{ background: tab.bg, color: tab.color, transform: activeTab === tab.id ? 'scale(1.08) translateY(-2px)' : undefined, boxShadow: activeTab === tab.id ? '0 6px 14px rgba(0,0,0,0.2)' : undefined, filter: activeTab === tab.id ? 'brightness(1.1)' : undefined }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div className="px-4 pb-12 pt-2">
          <div className="panel-anim" key={activeTab}>
            {activeTab === 1 && <Panel1 onResult={handleResult} />}
            {activeTab === 2 && <Panel2 onResult={handleResult} />}
            {activeTab === 3 && <Panel3 onResult={handleResult} />}
            {activeTab === 4 && <Panel4 />}
            {activeTab === 5 && <Panel5 onResult={handleResult} />}
            {activeTab === 6 && <Panel6 onResult={handleResult} />}
          </div>
        </div>

        <div className="pb-6 text-center text-sm text-gray-400">🌟 每天练一练，星期算得准！共6种魔法招式，你全学会了吗？ 🌟</div>
      </div>
    </>
  )
}
