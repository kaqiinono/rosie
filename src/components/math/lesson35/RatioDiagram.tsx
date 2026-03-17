'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Problem, RatioInput, OpInput, RatioColValue } from '@/utils/type'

interface RatioDiagramProps {
  problem: Problem
}

interface InputEntry {
  key: string
  ans: string | number
  isNum: boolean
}

function isRatioInput(v: RatioColValue): v is RatioInput {
  return typeof v === 'object' && v !== null && 'id' in v
}

export default function RatioDiagram({ problem }: RatioDiagramProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const probIdRef = useRef(problem.id)

  useEffect(() => {
    if (probIdRef.current !== problem.id) {
      setValues({})
      setFeedback(null)
      probIdRef.current = problem.id
    }
  }, [problem.id])

  const allInputs = useCallback((): InputEntry[] => {
    const entries: InputEntry[] = []
    problem.rows.forEach(r => {
      if (typeof r === 'object' && r !== null && 'id' in r) {
        entries.push({ key: (r as RatioInput).id, ans: (r as RatioInput).ans, isNum: true })
      }
    })
    problem.rcols.forEach(r => {
      if (isRatioInput(r)) entries.push({ key: r.id, ans: r.ans, isNum: true })
    })
    ;(problem.rows2 || []).forEach(r => {
      if (typeof r === 'object' && r !== null && 'id' in r) {
        entries.push({ key: (r as RatioInput).id, ans: (r as RatioInput).ans, isNum: true })
      }
    })
    ;(problem.ops || []).forEach((o, idx) => {
      if (problem.type === 'ratio3b' && idx >= 4) {
        entries.push({ key: `${o.id}-a`, ans: o.ans, isNum: false })
        entries.push({ key: `${o.id}-b`, ans: o.ans, isNum: false })
      } else {
        entries.push({ key: o.id, ans: o.ans, isNum: false })
      }
    })
    return entries
  }, [problem])

  const handleChange = useCallback(
    (key: string, val: string) => {
      const next = { ...values, [key]: val }
      setValues(next)

      const inputs = allInputs()
      const filled = inputs.filter(e => (next[e.key] || '') !== '')
      let allOk = true
      filled.forEach(e => {
        const v = e.isNum ? Number(next[e.key]) : next[e.key]?.trim()
        if (v !== e.ans) allOk = false
      })
      if (filled.length === inputs.length && allOk) {
        setFeedback({ text: '🎉 倍比图填写正确！继续写出最终答案吧。', ok: true })
      } else if (filled.length > 0 && !allOk) {
        setFeedback({ text: '💭 有些地方不对，想一想：先÷份数归一，再×份数求多', ok: false })
      } else {
        setFeedback(null)
      }
    },
    [values, allInputs],
  )

  function inputClass(key: string, isNum: boolean): string {
    const val = values[key]
    if (!val) return ''
    const entry = allInputs().find(e => e.key === key)
    if (!entry) return ''
    const v = isNum ? Number(val) : val.trim()
    return v === entry.ans ? 'correct' : 'incorrect'
  }

  if (problem.type === 'ratio3b') {
    return (
      <div>
        <div className="mb-3.5 rounded-lg border border-border-light bg-[#f9fafb] p-2.5">
          <Ratio3ColSVG
            problem={problem}
            values={values}
            onChange={handleChange}
            inputClass={inputClass}
          />
        </div>
        {feedback && (
          <div className={`mb-3 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
            {feedback.text}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3.5 rounded-lg border border-border-light bg-[#f9fafb] p-2.5">
        <Ratio2ColSVG
          problem={problem}
          values={values}
          onChange={handleChange}
          inputClass={inputClass}
        />
      </div>
      {feedback && (
        <div className={`mb-3 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}>
          {feedback.text}
        </div>
      )}
    </div>
  )
}

/* ═══ 2-Column SVG (ratio3) ═══ */
interface SvgProps {
  problem: Problem
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  inputClass: (key: string, isNum: boolean) => string
}

function RowCell({ r, x, y, w, color, values, onChange, inputClass }: {
  r: string | RatioInput; x: number; y: number; w: number; color: string
  values: Record<string, string>; onChange: (k: string, v: string) => void; inputClass: (k: string, n: boolean) => string
}) {
  if (typeof r === 'string') {
    return <text x={x + w / 2} y={y + 22} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill={color} fontWeight="600">{r}</text>
  }
  return (
    <foreignObject x={x + 2} y={y + 2} width={w - 4} height="40">
      <div className="flex h-full items-center justify-center gap-0.5">
        <input
          placeholder="?"
          className="w-[46px] border-none bg-transparent text-center text-sm font-bold outline-none"
          style={{ color, borderBottom: '1.5px solid', borderBottomColor: inputClass(r.id, true) === 'correct' ? '#22c55e' : inputClass(r.id, true) === 'incorrect' ? '#ef4444' : '#9ca3af' }}
          value={values[r.id] || ''}
          onChange={e => onChange(r.id, e.target.value)}
        />
        {r.unit && <span style={{ fontSize: 12, fontWeight: 600, color }}>{r.unit}</span>}
      </div>
    </foreignObject>
  )
}

function RcolCell({ r, x, y, w, values, onChange, inputClass }: {
  r: RatioColValue; x: number; y: number; w: number
  values: Record<string, string>; onChange: (k: string, v: string) => void; inputClass: (k: string, n: boolean) => string
}) {
  if (typeof r === 'string') {
    return <text x={x + w / 2} y={y + 22} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#15803d" fontWeight="600">{r}</text>
  }
  return (
    <foreignObject x={x + 2} y={y + 2} width={w - 4} height="40">
      <div className="flex h-full items-center justify-center gap-1">
        <input
          placeholder="?"
          className="w-[58px] border-none bg-transparent text-center text-sm font-bold text-[#15803d] outline-none"
          style={{ borderBottom: '1.5px solid', borderBottomColor: inputClass(r.id, true) === 'correct' ? '#22c55e' : inputClass(r.id, true) === 'incorrect' ? '#ef4444' : '#9ca3af' }}
          value={values[r.id] || ''}
          onChange={e => onChange(r.id, e.target.value)}
        />
      </div>
    </foreignObject>
  )
}

function OpCircle({ cx, cy, o, deep, values, onChange, inputClass }: {
  cx: number; cy: number; o: OpInput; deep: boolean
  values: Record<string, string>; onChange: (k: string, v: string) => void; inputClass: (k: string, n: boolean) => string
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="14" fill={deep ? '#ede9fe' : '#f5f3ff'} />
      <foreignObject x={cx - 13} y={cy - 13} width="26" height="26">
        <div className="flex h-[26px] w-[26px] items-center justify-center">
          <input
            type="text"
            placeholder="?"
            className="w-6 border-none bg-transparent text-center text-[10px] outline-none"
            value={values[o.id] || ''}
            onChange={e => onChange(o.id, e.target.value)}
            style={{ color: inputClass(o.id, false) === 'correct' ? '#22c55e' : inputClass(o.id, false) === 'incorrect' ? '#ef4444' : undefined }}
          />
        </div>
      </foreignObject>
    </g>
  )
}

function Ratio2ColSVG({ problem, values, onChange, inputClass }: SvgProps) {
  const id = problem.id
  const ops = problem.ops || []
  const nRows = problem.rows.length
  const compact = nRows <= 2

  if (compact) {
    const ly = [28, 148]
    return (
      <svg className="mx-auto block w-full max-w-[520px]" viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id={`arr-${id}`} viewBox="-1 -1 12 12" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <polygon points="9,5 0,0 0,10" fill="#9ca3af" />
          </marker>
        </defs>
        {ly.map(y => (
          <line key={`hd-${y}`} x1="142" y1={y + 22} x2="198" y2={y + 22} className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
        ))}
        <line x1="85" y1="80" x2="85" y2="139" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />
        <line x1="255" y1="80" x2="255" y2="139" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />
        {problem.rows.map((r, i) => (
          <g key={`row-${i}`}>
            <rect x="30" y={ly[i]} width="110" height="44" rx="10" fill="#dbeafe" />
            <RowCell r={r} x={30} y={ly[i]} w={110} color="#1d4ed8" values={values} onChange={onChange} inputClass={inputClass} />
          </g>
        ))}
        {problem.rcols.map((r, i) => (
          <g key={`rcol-${i}`}>
            <rect x="200" y={ly[i]} width="110" height="44" rx="10" fill="#dcfce7" />
            <RcolCell r={r} x={200} y={ly[i]} w={110} values={values} onChange={onChange} inputClass={inputClass} />
          </g>
        ))}
        {[
          { cx: 107, cy: 110, o: ops[0] },
          { cx: 277, cy: 110, o: ops[1] },
        ].filter(c => c.o).map(({ cx, cy, o }) => (
          <OpCircle key={o!.id} cx={cx} cy={cy} o={o!} deep={false} values={values} onChange={onChange} inputClass={inputClass} />
        ))}
      </svg>
    )
  }

  const ly = [18, 138, 258]
  const circles: { cx: number; cy: number; o: OpInput; deep: boolean }[] = [
    { cx: 107, cy: 100, o: ops[0], deep: false },
    { cx: 107, cy: 220, o: ops[1], deep: true },
    { cx: 277, cy: 100, o: ops[2], deep: false },
    { cx: 277, cy: 220, o: ops[3], deep: true },
  ].filter(c => c.o) as { cx: number; cy: number; o: OpInput; deep: boolean }[]

  return (
    <svg className="mx-auto block w-full max-w-[520px]" viewBox="0 0 340 320" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id={`arr-${id}`} viewBox="-1 -1 12 12" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <polygon points="9,5 0,0 0,10" fill="#9ca3af" />
        </marker>
      </defs>
      {/* H dashes */}
      <line x1="142" y1="40" x2="198" y2="40" className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
      <line x1="142" y1="160" x2="198" y2="160" className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
      <line x1="142" y1="280" x2="198" y2="280" className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
      {/* V arrows */}
      <line x1="85" y1="70" x2="85" y2="129" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />
      <line x1="85" y1="192" x2="85" y2="249" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />
      <line x1="255" y1="70" x2="255" y2="129" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />
      <line x1="255" y1="192" x2="255" y2="249" className="stroke-[#9ca3af] stroke-[1.8]" markerEnd={`url(#arr-${id})`} />

      {/* Left boxes (rows) */}
      {problem.rows.map((r, i) => (
        <g key={`row-${i}`}>
          <rect x="30" y={ly[i]} width="110" height="44" rx="10" fill="#dbeafe" />
          <RowCell r={r} x={30} y={ly[i]} w={110} color="#1d4ed8" values={values} onChange={onChange} inputClass={inputClass} />
        </g>
      ))}

      {/* Right boxes (rcols) */}
      {problem.rcols.map((r, i) => (
        <g key={`rcol-${i}`}>
          <rect x="200" y={ly[i]} width="110" height="44" rx="10" fill="#dcfce7" />
          <RcolCell r={r} x={200} y={ly[i]} w={110} values={values} onChange={onChange} inputClass={inputClass} />
        </g>
      ))}

      {/* Op circles */}
      {circles.map(({ cx, cy, o, deep }) => (
        <OpCircle key={o.id} cx={cx} cy={cy} o={o} deep={deep} values={values} onChange={onChange} inputClass={inputClass} />
      ))}
    </svg>
  )
}

/* ═══ 3-Column SVG (ratio3b / dual-guiyi) ═══ */
function Col3Cell({ r, x, y, w, color, values, onChange, inputClass }: {
  r: string | RatioInput; x: number; y: number; w: number; color: string
  values: Record<string, string>; onChange: (k: string, v: string) => void; inputClass: (k: string, n: boolean) => string
}) {
  if (typeof r === 'string') {
    return <text x={x + w / 2} y={y + 22} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill={color} fontWeight="600">{r}</text>
  }
  return (
    <foreignObject x={x + 2} y={y + 2} width={w - 4} height="40">
      <div className="flex h-full items-center justify-center gap-0.5">
        <input
          placeholder="?"
          className="w-[38px] border-none bg-transparent text-center text-[13px] font-bold outline-none"
          style={{ color, borderBottom: '1.5px solid', borderBottomColor: inputClass(r.id, true) === 'correct' ? '#22c55e' : inputClass(r.id, true) === 'incorrect' ? '#ef4444' : '#9ca3af' }}
          value={values[r.id] || ''}
          onChange={e => onChange(r.id, e.target.value)}
        />
        {r.unit && <span style={{ fontSize: 11, fontWeight: 600, color }}>{r.unit}</span>}
      </div>
    </foreignObject>
  )
}

function Ratio3ColSVG({ problem, values, onChange, inputClass }: SvgProps) {
  const id = problem.id
  const ops = problem.ops || []
  const rows2 = problem.rows2 || []
  const nRows = Math.max(problem.rows.length, rows2.length, problem.rcols.length)
  const hasRow4 = nRows >= 4
  const cA = 70, cB = 230, cC = 390

  const ly = hasRow4 ? [18, 128, 238, 370] : [18, 138, 258]
  const svgH = hasRow4 ? 440 : 320
  const sepY = hasRow4 ? 305 : 0

  const opCY0 = Math.round((ly[0] + 44 + ly[1]) / 2)
  const opCY1 = Math.round((ly[1] + 44 + ly[2]) / 2)
  const arrY = [
    { y1: ly[0] + 52, y2: ly[1] - 9 },
    { y1: ly[1] + 54, y2: ly[2] - 9 },
  ]

  return (
    <svg className="mx-auto block w-full max-w-[520px]" viewBox={`0 0 470 ${svgH}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id={`arr-${id}-a`} viewBox="-1 -1 12 12" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <polygon points="9,5 0,0 0,10" fill="#3b82f6" />
        </marker>
        <marker id={`arr-${id}-b`} viewBox="-1 -1 12 12" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <polygon points="9,5 0,0 0,10" fill="#6366f1" />
        </marker>
        <marker id={`arr-${id}-c`} viewBox="-1 -1 12 12" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <polygon points="9,5 0,0 0,10" fill="#10b981" />
        </marker>
      </defs>

      {/* H dashes A↔B and B↔C for each row */}
      {ly.map((y, i) => (
        <g key={`dash-${i}`}>
          <line x1="127" y1={y + 22} x2="173" y2={y + 22} className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
          <line x1="287" y1={y + 22} x2="333" y2={y + 22} className="stroke-[#cbd5e1] stroke-[1.5]" strokeDasharray="4 3" />
        </g>
      ))}

      {/* V arrows for row 0→1 and 1→2 only */}
      {[
        { cx: cA, color: '#3b82f6', mk: `arr-${id}-a` },
        { cx: cB, color: '#6366f1', mk: `arr-${id}-b` },
        { cx: cC, color: '#10b981', mk: `arr-${id}-c` },
      ].map(({ cx, color, mk }) => (
        <g key={`varr-${cx}`}>
          {arrY.map((a, ai) => (
            <line key={ai} x1={cx} y1={a.y1} x2={cx} y2={a.y2} stroke={color} strokeWidth="1.8" markerEnd={`url(#${mk})`} />
          ))}
        </g>
      ))}

      {/* Separator + label for 4th row */}
      {hasRow4 && (
        <g>
          <line x1="10" y1={sepY} x2="460" y2={sepY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="6 4" />
          <text x="235" y={sepY + 16} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">第二问</text>
        </g>
      )}

      {/* Col A boxes: rows (blue) */}
      {problem.rows.map((r, i) => ly[i] != null && (
        <g key={`rA-${i}`}>
          <rect x="15" y={ly[i]} width="110" height="44" rx="10" fill="#dbeafe" />
          <Col3Cell r={r} x={15} y={ly[i]} w={110} color="#1d4ed8" values={values} onChange={onChange} inputClass={inputClass} />
        </g>
      ))}

      {/* Col B boxes: rows2 (indigo) */}
      {rows2.map((r, i) => ly[i] != null && (
        <g key={`rB-${i}`}>
          <rect x="175" y={ly[i]} width="110" height="44" rx="10" fill="#e0e7ff" />
          <Col3Cell r={r} x={175} y={ly[i]} w={110} color="#4338ca" values={values} onChange={onChange} inputClass={inputClass} />
        </g>
      ))}

      {/* Col C boxes: rcols (green) */}
      {problem.rcols.map((r, i) => ly[i] != null && (
        <g key={`rC-${i}`}>
          <rect x="335" y={ly[i]} width="110" height="44" rx="10" fill="#dcfce7" />
          <Col3Cell r={r as string | RatioInput} x={335} y={ly[i]} w={110} color="#15803d" values={values} onChange={onChange} inputClass={inputClass} />
        </g>
      ))}

      {/* Col A circles (blue) */}
      {[
        { cx: cA + 22, cy: opCY0, o: ops[0], fill: '#3b82f622', color: '#3b82f6' },
        { cx: cA + 22, cy: opCY1, o: ops[1], fill: '#1d4ed822', color: '#1d4ed8' },
      ].filter(c => c.o).map(({ cx, cy, o, fill, color }) => (
        <g key={o!.id}>
          <circle cx={cx} cy={cy} r="14" fill={fill} />
          <foreignObject x={cx - 13} y={cy - 13} width="26" height="26">
            <div className="flex h-[26px] w-[26px] items-center justify-center">
              <input
                type="text" placeholder="?"
                className="w-6 border-none bg-transparent text-center text-[9px] font-bold outline-none"
                style={{ color: inputClass(o!.id, false) === 'correct' ? '#22c55e' : inputClass(o!.id, false) === 'incorrect' ? '#ef4444' : color }}
                value={values[o!.id] || ''}
                onChange={e => onChange(o!.id, e.target.value)}
              />
            </div>
          </foreignObject>
        </g>
      ))}

      {/* Col B circles (indigo) */}
      {[
        { cx: cB + 22, cy: opCY0, o: ops[2], fill: '#6366f122', color: '#6366f1' },
        { cx: cB + 22, cy: opCY1, o: ops[3], fill: '#4338ca22', color: '#4338ca' },
      ].filter(c => c.o).map(({ cx, cy, o, fill, color }) => (
        <g key={o!.id}>
          <circle cx={cx} cy={cy} r="14" fill={fill} />
          <foreignObject x={cx - 13} y={cy - 13} width="26" height="26">
            <div className="flex h-[26px] w-[26px] items-center justify-center">
              <input
                type="text" placeholder="?"
                className="w-6 border-none bg-transparent text-center text-[9px] font-bold outline-none"
                style={{ color: inputClass(o!.id, false) === 'correct' ? '#22c55e' : inputClass(o!.id, false) === 'incorrect' ? '#ef4444' : color }}
                value={values[o!.id] || ''}
                onChange={e => onChange(o!.id, e.target.value)}
              />
            </div>
          </foreignObject>
        </g>
      ))}

      {/* Col C paired circles */}
      {ops.slice(4, 6).filter(Boolean).map((o, idx) => {
        const cy = idx === 0 ? opCY0 : opCY1
        const cxA = cC + 20, cxB = cC + 44
        return (
          <g key={`cC-${idx}`}>
            <circle cx={cxA} cy={cy} r="12" fill="#3b82f622" />
            <foreignObject x={cxA - 11} y={cy - 11} width="22" height="22">
              <div className="flex h-[22px] w-[22px] items-center justify-center">
                <input
                  type="text" placeholder="?"
                  className="w-5 border-none bg-transparent text-center text-[8px] font-bold text-[#1d4ed8] outline-none"
                  value={values[`${o.id}-a`] || ''}
                  onChange={e => onChange(`${o.id}-a`, e.target.value)}
                  style={{ color: inputClass(`${o.id}-a`, false) === 'correct' ? '#22c55e' : inputClass(`${o.id}-a`, false) === 'incorrect' ? '#ef4444' : '#1d4ed8' }}
                />
              </div>
            </foreignObject>
            <circle cx={cxB} cy={cy} r="12" fill="#6366f122" />
            <foreignObject x={cxB - 11} y={cy - 11} width="22" height="22">
              <div className="flex h-[22px] w-[22px] items-center justify-center">
                <input
                  type="text" placeholder="?"
                  className="w-5 border-none bg-transparent text-center text-[8px] font-bold text-[#4338ca] outline-none"
                  value={values[`${o.id}-b`] || ''}
                  onChange={e => onChange(`${o.id}-b`, e.target.value)}
                  style={{ color: inputClass(`${o.id}-b`, false) === 'correct' ? '#22c55e' : inputClass(`${o.id}-b`, false) === 'incorrect' ? '#ef4444' : '#4338ca' }}
                />
              </div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}
