'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ── constants ──────────────────────────────────────────────────────────────
const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SHORT = ['日', '一', '二', '三', '四', '五', '六']
const HEADS = ['一', '二', '三', '四', '五', '六', '日']

const DAY_COLORS = [
  { bg: '#FF6B6B', text: '#fff' },
  { bg: '#FF9F43', text: '#fff' },
  { bg: '#FECA57', text: '#555' },
  { bg: '#48DBFB', text: '#555' },
  { bg: '#1DD1A1', text: '#fff' },
  { bg: '#A29BFE', text: '#fff' },
  { bg: '#FD79A8', text: '#fff' },
]

const CONFETTI_COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#1DD1A1', '#A29BFE', '#FD79A8', '#FF9F43']

// ── types ──────────────────────────────────────────────────────────────────
interface ConfettiPiece {
  id: number
  left: string
  color: string
  delay: string
  duration: string
  rotation: number
}

interface RulerCell {
  dayShort: string
  offset: number
  type: 'known' | 'jump' | 'target' | 'dots'
}

interface MonthCell {
  day: number | null
  type: 'empty' | 'normal' | 'extra1' | 'extra2' | 'target'
}

// ── helpers ────────────────────────────────────────────────────────────────
function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

let confettiId = 0

// ── sub-components ─────────────────────────────────────────────────────────

function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute h-3.5 w-2.5 rounded-sm opacity-0"
          style={{
            left: p.left,
            top: '-20px',
            background: p.color,
            animationName: 'confettiFall',
            animationDuration: p.duration,
            animationDelay: p.delay,
            animationFillMode: 'forwards',
            animationTimingFunction: 'ease-out',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function WeekStrip({ highlightedDay }: { highlightedDay: number | null }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 py-4">
      {DAY_COLORS.map((c, i) => {
        const dayVal = i === 6 ? 0 : i + 1  // Mon=1..Sat=6,Sun=0
        const isHighlighted = highlightedDay !== null && ((highlightedDay % 7 + 7) % 7) === dayVal
        return (
          <div
            key={i}
            className="flex h-13 w-13 cursor-pointer select-none items-center justify-center rounded-full border-[3px] border-white/60 text-base font-bold shadow-lg transition-transform duration-200 hover:scale-110 hover:-rotate-6"
            style={{
              width: 52,
              height: 52,
              background: c.bg,
              color: c.text,
              transform: isHighlighted ? 'scale(1.3)' : undefined,
              boxShadow: isHighlighted ? '0 0 0 5px gold, 0 4px 20px rgba(0,0,0,0.3)' : undefined,
              transition: 'all 0.3s',
            }}
          >
            {SHORT[dayVal]}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab 1 ──────────────────────────────────────────────────────────────────
function Panel1({ onResult }: { onResult: (day: number) => void }) {
  const [knownDay, setKnownDay] = useState(6)
  const [days, setDays] = useState(80)
  const [ruler, setRuler] = useState<RulerCell[]>([])
  const [result, setResult] = useState<{ weeks: number; rem: number; target: number } | null>(null)

  const calc = useCallback(() => {
    const rem = days % 7
    const target = (knownDay + days) % 7
    const cells: RulerCell[] = []
    if (days <= 13) {
      for (let i = 0; i <= days; i++) {
        cells.push({
          dayShort: SHORT[(knownDay + i) % 7],
          offset: i,
          type: i === 0 ? 'known' : i === days ? 'target' : 'jump',
        })
      }
    } else {
      for (let i = 0; i <= 3; i++) {
        cells.push({ dayShort: SHORT[(knownDay + i) % 7], offset: i, type: i === 0 ? 'known' : 'jump' })
      }
      cells.push({ dayShort: '…', offset: -1, type: 'dots' })
      for (let i = days - 3; i <= days; i++) {
        cells.push({ dayShort: SHORT[(knownDay + i) % 7], offset: i, type: i === days ? 'target' : 'jump' })
      }
    }
    setRuler(cells)
    setResult({ weeks: Math.floor(days / 7), rem, target })
    onResult(target)
  }, [knownDay, days, onResult])

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🗓️ 题型1 · 同月及跨月</h2>
      <p className="mb-5 text-sm text-gray-400">同一年内，已知某日是星期几，推算其他日期。</p>

      <div className="space-y-3">
        {[
          { num: '1', title: '找出两个日期', bold: '相差几天', eg: '4月4日 → 6月23日，先数一数差多少天' },
          { num: '2', title: '把天数', bold: '除以7，看余数', eg: '一个星期有7天，走完7天又回到同一天！' },
          { num: '3', title: '从已知星期几，', bold: '往后数余数那么多格', eg: '余数是3，就从周六往后数3格' },
        ].map((s) => (
          <div key={s.num} className="flex items-start gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
            >
              {s.num}
            </div>
            <div>
              <span className="text-gray-700">{s.title}</span>
              <strong className="text-[#6c4eb0]">{s.bold}</strong>
              <div className="mt-1 text-xs italic text-gray-400">{s.eg}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Demo */}
      <div
        className="mt-5 rounded-2xl border-2 border-dashed border-[#c8b4f8] p-5"
        style={{ background: 'linear-gradient(135deg,#f3eeff,#e8f5ff)' }}
      >
        <h3 className="mb-4 text-lg font-bold text-[#5c3d9e]">🎮 来试试！</h3>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">已知日期是</label>
          <select
            className="rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
            value={knownDay}
            onChange={(e) => setKnownDay(Number(e.target.value))}
          >
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">再过</label>
          <input
            type="number" min={1} max={365}
            className="w-24 rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value))))}
          />
          <label className="text-sm text-gray-500">天是？</label>
        </div>
        <button
          className="rounded-full px-7 py-2.5 font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
          onClick={calc}
        >
          ✨ 算一算！
        </button>

        {/* Ruler */}
        {ruler.length > 0 && (
          <div className="mt-3 flex items-center overflow-x-auto pb-1">
            {ruler.map((cell, i) => (
              <div
                key={i}
                className="flex min-w-[40px] flex-col items-center justify-center border-2 py-1 text-xs transition-all first:rounded-l-lg last:rounded-r-lg"
                style={{
                  height: 44,
                  background: cell.type === 'known' ? '#48DBFB' : cell.type === 'target' ? '#FF6B6B' : cell.type === 'dots' ? '#eee' : '#FECA57',
                  color: cell.type === 'target' || cell.type === 'known' ? '#fff' : '#555',
                  borderColor: cell.type === 'known' ? '#48DBFB' : cell.type === 'target' ? '#FF6B6B' : '#ccc',
                  transform: cell.type === 'target' ? 'scaleY(1.12)' : undefined,
                }}
              >
                <span className="font-bold">{cell.dayShort}</span>
                {cell.type !== 'dots' && <span className="opacity-70">+{cell.offset}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm text-gray-600">
            再过 <strong>{days}</strong> 天 ÷ 7 = {result.weeks}周 余 <strong>{result.rem}</strong> 天<br />
            从 <strong>{DAYS[knownDay]}</strong> 往后数 <strong>{result.rem}</strong> 格 →{' '}
            <span className="text-2xl font-bold text-[#FF6B6B]">{DAYS[result.target]}</span> 🎉
          </div>
        )}
        {!result && (
          <div className="mt-3 rounded-2xl bg-white p-4 text-sm text-gray-400 shadow-sm">点上面的按钮开始！</div>
        )}
      </div>
    </div>
  )
}

// ── Tab 2 ──────────────────────────────────────────────────────────────────
const YEAR_TIMELINE = [
  { year: 2023, day: 0 },
  { year: 2024, day: 1 },
  { year: 2025, day: 3 },
  { year: 2026, day: 4 },
]

function Panel2({ onResult }: { onResult: (day: number) => void }) {
  const [targetYear, setTargetYear] = useState(2026)
  const [steps, setSteps] = useState<string[]>([])
  const [finalDay, setFinalDay] = useState<number | null>(null)

  const calc = useCallback(() => {
    let day = 0
    let year = 2023
    const s: string[] = []
    while (year < targetYear) {
      const leap = isLeap(year)
      const shift = leap ? 2 : 1
      s.push(`${year}年是${leap ? '闰' : '平'}年，+${shift}`)
      day = (day + shift) % 7
      year++
    }
    setSteps(s)
    setFinalDay(day)
    onResult(day)
  }, [targetYear, onResult])

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🌍 题型2 · 跨年推算</h2>
      <p className="mb-5 text-sm text-gray-400">跨越多年推算目标日期的星期几。平年+1，闰年+2。</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[130px] rounded-2xl border-2 border-[#c8b4f8] bg-[#f3eeff] p-4 text-[#5c3d9e]">
          🌱 <strong>平年</strong>：365天<br />
          365 ÷ 7 = 52周 <strong>余1</strong><br />
          下一年同一天<strong>往后移1天</strong>
        </div>
        <div className="text-3xl animate-[arrowBounce_1s_ease-in-out_infinite]">➡️</div>
        <div className="flex-1 min-w-[130px] rounded-2xl border-2 border-[#c8b4f8] bg-[#f3eeff] p-4 text-[#5c3d9e]">
          🐸 <strong>闰年</strong>：366天<br />
          366 ÷ 7 = 52周 <strong>余2</strong><br />
          下一年同一天<strong>往后移2天</strong>
        </div>
      </div>

      {/* Fixed year timeline */}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {YEAR_TIMELINE.map((item, i) => (
          <div key={item.year} className="flex items-center gap-3">
            <div className="rounded-2xl border-2 border-[#c8b4f8] bg-[#f3eeff] px-5 py-3 text-center">
              <div className="text-xs text-gray-400">{item.year}年1月1日</div>
              <div className="my-1 text-3xl font-bold text-[#6c4eb0]">{SHORT[item.day]}</div>
              <div className="text-xs text-[#5c3d9e]">{DAYS[item.day]}</div>
            </div>
            {i < YEAR_TIMELINE.length - 1 && (
              <div className="flex flex-col items-center text-xs text-gray-400">
                <span className="text-2xl text-[#a29bfe]">→</span>
                <span>{isLeap(item.year) ? '闰年+2' : '平年+1'}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Demo */}
      <div
        className="mt-5 rounded-2xl border-2 border-dashed border-[#c8b4f8] p-5"
        style={{ background: 'linear-gradient(135deg,#f3eeff,#e8f5ff)' }}
      >
        <h3 className="mb-4 text-lg font-bold text-[#5c3d9e]">🎮 来试试！（从2023年1月1日=周日出发）</h3>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">目标年份</label>
          <input
            type="number" min={2023} max={2040}
            className="w-24 rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
            value={targetYear}
            onChange={(e) => setTargetYear(Math.max(2023, Math.min(2040, Number(e.target.value))))}
          />
          <label className="text-sm text-gray-500">年1月1日是？</label>
        </div>
        <button
          className="rounded-full px-7 py-2.5 font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
          onClick={calc}
        >
          ✨ 算一算！
        </button>
        <div className="mt-3 rounded-2xl bg-white p-4 text-sm shadow-sm min-h-[60px]">
          {finalDay !== null ? (
            <>
              {steps.map((s, i) => (
                <span key={i} className="mr-1 text-xs text-gray-400">{s}{i < steps.length - 1 ? ' → ' : ''}</span>
              ))}
              <br />
              → {targetYear}年1月1日是{' '}
              <span className="text-2xl font-bold text-[#FF6B6B]">{DAYS[finalDay]}</span> 🎉
            </>
          ) : (
            <span className="text-gray-400">点上面的按钮开始！</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab 3 ──────────────────────────────────────────────────────────────────
function Panel3({ onResult }: { onResult: (day: number) => void }) {
  const [totalDays, setTotalDays] = useState(31)
  const [startDay, setStartDay] = useState(3)
  const [cells, setCells] = useState<MonthCell[]>([])
  const [result, setResult] = useState<{ extra: number; lastDay: number; extraDays: number[] } | null>(null)

  const build = useCallback(() => {
    const offset = startDay === 0 ? 6 : startDay - 1
    const counts = Array(7).fill(0)
    for (let d = 0; d < totalDays; d++) counts[(startDay + d) % 7]++
    const maxCount = Math.max(...counts)
    const fiveTimes = counts.map((c, i) => c === maxCount ? i : -1).filter((i) => i >= 0)
    const lastDayOfWeek = (startDay + totalDays - 1) % 7

    const newCells: MonthCell[] = [
      ...Array(offset).fill(null).map(() => ({ day: null, type: 'empty' as const })),
      ...Array(totalDays).fill(null).map((_, d) => {
        const dow = (startDay + d) % 7
        let type: MonthCell['type'] = 'normal'
        if (d + 1 === totalDays) type = 'target'
        else if (fiveTimes.length >= 2 && dow === fiveTimes[0]) type = 'extra1'
        else if (fiveTimes.length >= 2 && dow === fiveTimes[1]) type = 'extra2'
        return { day: d + 1, type }
      }),
    ]

    setCells(newCells)
    setResult({ extra: totalDays - 28, lastDay: lastDayOfWeek, extraDays: fiveTimes })
    onResult(lastDayOfWeek)
  }, [totalDays, startDay, onResult])

  useEffect(() => { build() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cellStyle = (type: MonthCell['type']) => {
    if (type === 'target') return { background: '#FF6B6B', color: '#fff', transform: 'scale(1.1)', fontWeight: 'bold' }
    if (type === 'extra1') return { background: '#48DBFB', color: '#fff' }
    if (type === 'extra2') return { background: '#1DD1A1', color: '#fff' }
    if (type === 'normal') return { background: '#f0f0f0', color: '#555' }
    return {}
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#fffdf7] p-6 shadow-xl">
      <h2 className="mb-1 text-2xl font-bold text-[#5c3d9e]">🔍 题型3 · 确定星期几</h2>
      <p className="mb-5 text-sm text-gray-400">根据星期分布（多/少）或日期总和，确定特定日期的星期。</p>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3eeff] text-lg">💡</div>
          <div className="text-gray-700 text-sm">
            一个月有 <strong className="text-[#6c4eb0]">28、29、30或31天</strong><br />
            28天 = 恰好4个完整星期（每天都出现4次）<br />
            多出来的天数，某些星期会多出现1次
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3eeff] text-lg">🧩</div>
          <div className="text-gray-700 text-sm">
            <strong className="text-[#6c4eb0]">例：某月有4个周二和5个周三，31日是？</strong><br />
            31天 = 28 + 3天多出来<br />
            多的3天：周三、周四、周五各多1次（31日=周五）
          </div>
        </div>
      </div>

      {/* Month grid */}
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {HEADS.map((h) => (
          <div key={h} className="py-1 text-center text-xs font-bold text-gray-400">{h}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className="flex h-9 items-center justify-center rounded-lg text-sm transition-all duration-300"
            style={cell.type === 'empty' ? {} : cellStyle(cell.type)}
          >
            {cell.day}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-lg px-3 py-1 text-xs font-medium text-white" style={{ background: '#48DBFB' }}>🔵 出现5次的第一天</span>
        <span className="rounded-lg px-3 py-1 text-xs font-medium text-white" style={{ background: '#1DD1A1' }}>🟢 出现5次的第二天</span>
        <span className="rounded-lg px-3 py-1 text-xs font-medium text-white" style={{ background: '#FF6B6B' }}>🔴 最后一天</span>
      </div>

      {/* Demo */}
      <div
        className="mt-5 rounded-2xl border-2 border-dashed border-[#c8b4f8] p-5"
        style={{ background: 'linear-gradient(135deg,#f3eeff,#e8f5ff)' }}
      >
        <h3 className="mb-4 text-lg font-bold text-[#5c3d9e]">🎮 来试试！</h3>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">这个月有</label>
          <input
            type="number" min={28} max={31}
            className="w-20 rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
            value={totalDays}
            onChange={(e) => setTotalDays(Math.max(28, Math.min(31, Number(e.target.value))))}
          />
          <label className="text-sm text-gray-500">天</label>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">1号是</label>
          <select
            className="rounded-xl border-2 border-[#c8b4f8] bg-white px-3 py-2 text-[#5c3d9e] outline-none"
            value={startDay}
            onChange={(e) => setStartDay(Number(e.target.value))}
          >
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <button
          className="rounded-full px-7 py-2.5 font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#a29bfe,#6c5ce7)' }}
          onClick={build}
        >
          ✨ 画出来！
        </button>
        <div className="mt-3 rounded-2xl bg-white p-4 text-sm shadow-sm min-h-[60px]">
          {result ? (
            <>
              {totalDays}天 = 28天 + <strong>多出{result.extra}天</strong><br />
              多出来的{result.extra}天，从1号({DAYS[startDay]})开始排：
              {Array.from({ length: result.extra }, (_, i) => DAYS[(startDay + i) % 7]).join('、')}<br />
              所以这{result.extra}天各出现<strong>5次</strong>，其余出现<strong>4次</strong><br />
              第{totalDays}天（最后一天）是{' '}
              <span className="text-2xl font-bold text-[#FF6B6B]">{DAYS[result.lastDay]}</span> 🎉
            </>
          ) : (
            <span className="text-gray-400">点上面的按钮开始！</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WeekdayMagic() {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1)
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null)
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleResult = useCallback((day: number) => {
    setHighlightedDay(day)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightedDay(null), 2500)

    // spawn confetti
    const pieces: ConfettiPiece[] = Array.from({ length: 30 }, () => ({
      id: confettiId++,
      left: `${Math.random() * 100}vw`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: `${(Math.random() * 0.6).toFixed(2)}s`,
      duration: `${(1 + Math.random()).toFixed(2)}s`,
      rotation: Math.floor(Math.random() * 360),
    }))
    setConfetti(pieces)
    setTimeout(() => setConfetti([]), 2600)
  }, [])

  const tabs = [
    { id: 1 as const, label: '🗓️ 题型1 · 同月跨月', bg: '#c8e6ff', color: '#2d6da3' },
    { id: 2 as const, label: '🌍 题型2 · 跨年推算', bg: '#c8f5d8', color: '#1d7a4a' },
    { id: 3 as const, label: '🔍 题型3 · 确定星期几', bg: '#fff0c8', color: '#8a6a00' },
  ]

  return (
    <>
      {/* Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap');
        @keyframes bounceY {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes arrowBounce {
          0%,100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: none; }
        }
        .weekday-font { font-family: 'ZCOOL XiaoWei', 'PingFang SC', sans-serif; }
        .panel-animate { animation: fadeInUp 0.4s ease; }
      `}</style>

      <div
        className="weekday-font min-h-screen overflow-x-hidden"
        style={{ background: 'linear-gradient(180deg,#a8edea 0%,#fed6e3 100%)' }}
      >
        <Confetti pieces={confetti} />

        {/* Hero */}
        <div className="px-4 pb-3 pt-7 text-center">
          <h1
            className="font-extrabold text-[#6c4eb0]"
            style={{
              fontSize: 'clamp(2rem,6vw,3.2rem)',
              textShadow: '3px 3px 0 #e8c0ff, 0 0 20px rgba(255,255,255,0.8)',
              animation: 'bounceY 2s ease-in-out infinite',
            }}
          >
            🌈 星期魔法书 ✨
          </h1>
          <p className="mt-1.5 text-lg text-[#7c5cbf]">知道今天是星期几，就能算出任何一天！</p>
        </div>

        <WeekStrip highlightedDay={highlightedDay} />

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-3 px-4 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full px-5 py-2.5 text-sm font-bold shadow-md transition-all duration-200"
              style={{
                background: tab.bg,
                color: tab.color,
                transform: activeTab === tab.id ? 'scale(1.08) translateY(-2px)' : undefined,
                boxShadow: activeTab === tab.id ? '0 6px 14px rgba(0,0,0,0.2)' : undefined,
                filter: activeTab === tab.id ? 'brightness(1.1)' : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div className="px-4 pb-10">
          <div className="panel-animate" key={activeTab}>
            {activeTab === 1 && <Panel1 onResult={handleResult} />}
            {activeTab === 2 && <Panel2 onResult={handleResult} />}
            {activeTab === 3 && <Panel3 onResult={handleResult} />}
          </div>
        </div>

        <div className="pb-6 text-center text-sm text-gray-400">
          🌟 每天练一练，星期算得准！ 🌟
        </div>
      </div>
    </>
  )
}
