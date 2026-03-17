'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { WordEntry } from '@/utils/type'
import { buildDailyPlan, hilite, highlightExample, shuffle, type DayPlan } from '@/utils/english-helpers'
import PhonicsWord from './PhonicsWord'

const DP_STORAGE_KEY = 'wm_daily_progress'

interface DailyPracticeProps {
  vocab: WordEntry[]
}

type Phase = 'selector' | 'study' | 'quiz' | 'done'
interface DpQuizQ { word: WordEntry; type: 'A' | 'B' | 'C'; isReview: boolean }

function loadProgress(): Record<string, { quizDone?: boolean; lastScore?: number; lastDate?: string }> {
  try { return JSON.parse(localStorage.getItem(DP_STORAGE_KEY) || '{}') }
  catch { return {} }
}
function saveProgress(p: Record<string, unknown>) {
  localStorage.setItem(DP_STORAGE_KEY, JSON.stringify(p))
}

export default function DailyPractice({ vocab }: DailyPracticeProps) {
  const plan = useMemo(() => buildDailyPlan(vocab.length), [vocab.length])
  const [selDays, setSelDays] = useState<Set<number>>(new Set())
  const [phase, setPhase] = useState<Phase>('selector')
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(['A', 'B']))
  const [defOnly, setDefOnly] = useState(false)
  const [studyDefOnly, setStudyDefOnly] = useState(false)
  const [studyWordVisible, setStudyWordVisible] = useState(false)

  const [words, setWords] = useState<{ entry: WordEntry; isReview: boolean }[]>([])
  const [studyIdx, setStudyIdx] = useState(0)

  const [quizQs, setQuizQs] = useState<DpQuizQ[]>([])
  const [curQ, setCurQ] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [spellVal, setSpellVal] = useState('')
  const [spellOk, setSpellOk] = useState<boolean | null>(null)
  const spellRef = useRef<HTMLInputElement>(null)

  const [prog] = useState(() => loadProgress())
  const doneDays = useMemo(() => Object.keys(prog).filter(k => prog[k]?.quizDone).map(Number), [prog])

  const toggleDay = useCallback((d: number) => {
    setSelDays(prev => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }, [])

  const sessionWords = useMemo(() => {
    const wordSet = new Set<number>()
    const sorted = [...selDays].sort((a, b) => a - b)
    sorted.forEach(d => { plan.find(x => x.day === d)?.newWords.forEach(i => wordSet.add(i)) })
    sorted.forEach(d => { plan.find(x => x.day === d)?.reviewWords.forEach(i => wordSet.add(i)) })
    return [...wordSet]
  }, [selDays, plan])

  const isReviewIdx = useCallback((idx: number) => {
    for (const d of selDays) {
      const p = plan.find(x => x.day === d)
      if (p && p.reviewWords.includes(idx)) return true
    }
    return false
  }, [selDays, plan])

  const sessionEntries = useMemo(
    () => sessionWords.map(i => ({ entry: vocab[i], isReview: isReviewIdx(i) })),
    [sessionWords, vocab, isReviewIdx]
  )

  const newCount = sessionEntries.filter(e => !e.isReview).length
  const revCount = sessionEntries.filter(e => e.isReview).length

  const startStudy = useCallback(() => {
    if (!selDays.size) return
    if (!enabledTypes.size) { alert('请至少选择一种题型！'); return }
    setWords(sessionEntries)
    setStudyIdx(0)
    setStudyWordVisible(false)
    setStudyDefOnly(defOnly)
    setPhase('study')
  }, [selDays, enabledTypes, sessionEntries, defOnly])

  const startQuiz = useCallback(() => {
    const types = [...enabledTypes] as ('A' | 'B' | 'C')[]
    let qs: DpQuizQ[] = []
    words.forEach(w => {
      types.forEach(t => qs.push({ word: w.entry, type: t, isReview: w.isReview }))
    })
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]]
    }
    setQuizQs(qs)
    setCurQ(0)
    setScore(0)
    setAnswered(false)
    setSelected(null)
    setSpellVal('')
    setSpellOk(null)
    setPhase('quiz')
  }, [words, enabledTypes])

  const handleMC = useCallback((chosen: string, correct: string) => {
    if (answered) return
    setAnswered(true)
    setSelected(chosen)
    if (chosen === correct) setScore(s => s + 1)
  }, [answered])

  const handleSpell = useCallback(() => {
    if (answered) return
    setAnswered(true)
    const ok = spellVal.trim().toLowerCase() === quizQs[curQ]?.word.word.toLowerCase()
    setSpellOk(ok)
    if (ok) setScore(s => s + 1)
  }, [answered, spellVal, quizQs, curQ])

  const nextQ = useCallback(() => {
    const next = curQ + 1
    if (next >= quizQs.length) {
      const total = quizQs.length
      const pct = Math.round(score / total * 100)
      const p = loadProgress()
      selDays.forEach(d => {
        if (!p[d]) p[d] = {}
        ;(p[d] as Record<string, unknown>).quizDone = true
        ;(p[d] as Record<string, unknown>).lastScore = pct
        ;(p[d] as Record<string, unknown>).lastDate = new Date().toLocaleDateString('zh-CN')
      })
      saveProgress(p)
      setPhase('done')
    } else {
      setCurQ(next)
      setAnswered(false)
      setSelected(null)
      setSpellVal('')
      setSpellOk(null)
      if (quizQs[next]?.type === 'C') setTimeout(() => spellRef.current?.focus(), 100)
    }
  }, [curQ, quizQs, score, selDays])

  const resetProgress = useCallback(() => {
    if (confirm('确认重置所有学习进度？')) {
      saveProgress({})
      setSelDays(new Set())
    }
  }, [])

  // SELECTOR
  if (phase === 'selector') {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-5">
        <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[20px] p-7 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="font-fredoka text-2xl bg-gradient-to-br from-[#f59e0b] to-[#f97316] bg-clip-text text-transparent">📅 每日一练</div>
              <div className="text-[.75rem] text-[var(--wm-text-dim)] font-bold mt-1">科学间隔复习 · 每天新词3个 · 总量≤20</div>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <div className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl px-3.5 py-2 text-center">
                <div className="font-fredoka text-[1.4rem] leading-none text-[#f59e0b]">{plan.length}</div>
                <div className="text-[.6rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider mt-0.5">总天数</div>
              </div>
              <div className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl px-3.5 py-2 text-center">
                <div className="font-fredoka text-[1.4rem] leading-none text-[#4ade80]">{doneDays.length}</div>
                <div className="text-[.6rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider mt-0.5">已完成</div>
              </div>
              <div className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl px-3.5 py-2 text-center">
                <div className="font-fredoka text-[1.4rem] leading-none text-[#a78bfa]">{vocab.length}</div>
                <div className="text-[.6rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider mt-0.5">总词数</div>
              </div>
            </div>
          </div>

          <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5">选择练习的天</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {plan.map(p => {
              const isDone = doneDays.includes(p.day)
              const hasRev = p.reviewWords.length > 0
              const tc = isDone ? 'border-[rgba(74,222,128,.4)] text-[#4ade80]' : hasRev ? 'border-[rgba(96,165,250,.4)] text-[#60a5fa]' : 'border-[rgba(249,115,22,.4)] text-[#fb923c]'
              const dotBg = isDone ? '#4ade80' : hasRev ? '#60a5fa' : '#f97316'
              const lbl = isDone ? '✓' : hasRev ? '复+新' : '新词'
              const isActive = selDays.has(p.day)
              const activeCls = isActive ? (isDone ? 'bg-[rgba(74,222,128,.15)] border-[#4ade80] shadow-[0_3px_12px_rgba(74,222,128,.25)]' : hasRev ? 'bg-[rgba(96,165,250,.15)] border-[#60a5fa] shadow-[0_3px_12px_rgba(96,165,250,.25)]' : 'bg-[rgba(249,115,22,.15)] border-[#f97316] shadow-[0_3px_12px_rgba(249,115,22,.25)]') : ''

              return (
                <button
                  key={p.day}
                  onClick={() => toggleDay(p.day)}
                  className={`px-3.5 py-2 rounded-[10px] border-[1.5px] bg-[var(--wm-surface2)] font-nunito text-[.78rem] font-extrabold cursor-pointer transition-all select-none flex items-center gap-1.5 ${tc} ${activeCls} ${isActive ? '-translate-y-px' : ''}`}
                >
                  <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dotBg }} />
                  Day {p.day}
                  <span className="text-[.65rem] opacity-70">{lbl} {p.totalCount}词</span>
                </button>
              )
            })}
          </div>

          {selDays.size > 0 && (
            <>
              <div className="bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl px-5 py-3.5 mb-4">
                <div className="flex justify-between items-center text-[.8rem] font-bold py-1">
                  <span className="text-[var(--wm-text-dim)]">已选天数</span>
                  <span className="text-[var(--wm-text)]">{[...selDays].sort((a, b) => a - b).map(d => 'Day ' + d).join(', ')}</span>
                </div>
                <div className="flex justify-between items-center text-[.8rem] font-bold py-1 border-t border-[var(--wm-border)] mt-1.5 pt-2.5">
                  <span className="text-[var(--wm-text-dim)]">本次单词</span>
                  <span className="text-[var(--wm-text)]">
                    <span className="bg-[rgba(249,115,22,.15)] text-[#fb923c] border border-[rgba(249,115,22,.3)] px-2 py-0.5 rounded-full text-[.68rem]">新词 {newCount}</span>
                    {revCount > 0 && <span className="bg-[rgba(96,165,250,.15)] text-[#93c5fd] border border-[rgba(96,165,250,.3)] px-2 py-0.5 rounded-full text-[.68rem] ml-1.5">复习 {revCount}</span>}
                    <span className="ml-2">共 {sessionEntries.length} 词</span>
                  </span>
                </div>
              </div>

              <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5 mt-5">题型选择（可多选）</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['A', 'B', 'C'] as const).map(t => {
                  const labels = { A: '释义 → 选单词', B: '单词 → 选释义', C: '释义 → 默写' }
                  const on = enabledTypes.has(t)
                  return (
                    <button
                      key={t}
                      onClick={() => setEnabledTypes(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border-[1.5px] cursor-pointer text-[.82rem] font-bold transition-all select-none ${
                        on ? 'border-[rgba(167,139,250,.5)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd]' : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] text-[.6rem] font-black ${
                        t === 'A' ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]' : t === 'B' ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]' : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                      }`}>{t}</span>
                      {labels[t]}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between p-3.5 px-4 bg-[var(--wm-surface2)] border border-[var(--wm-border)] rounded-xl mt-3 gap-3">
                <div>
                  <div className="font-extrabold text-[.82rem]">✨ 仅看释义模式</div>
                  <div className="text-[.7rem] text-[var(--wm-text-dim)] mt-0.5">记忆阶段只显示释义，点击右侧可查看单词</div>
                </div>
                <button
                  onClick={() => setDefOnly(!defOnly)}
                  className={`w-11 h-6 rounded-xl relative shrink-0 cursor-pointer transition-all border-[1.5px] ${
                    defOnly ? 'bg-[rgba(245,158,11,.3)] border-[#f59e0b]' : 'bg-white/10 border-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all ${
                    defOnly ? 'translate-x-5 bg-[#f59e0b]' : 'bg-white/40'
                  }`} />
                </button>
              </div>

              <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-widest mb-2.5 mt-5">本次练习单词</div>
              <div className="flex flex-wrap gap-1.5 py-3">
                {sessionEntries.map(e => (
                  <span
                    key={e.entry.word}
                    className={`px-3 py-1.5 rounded-full border-[1.5px] text-[.78rem] font-bold cursor-default ${
                      e.isReview
                        ? 'border-[rgba(96,165,250,.35)] text-[#93c5fd] bg-[rgba(96,165,250,.08)]'
                        : 'border-[rgba(249,115,22,.4)] text-[#fb923c] bg-[rgba(249,115,22,.08)]'
                    }`}
                  >
                    {e.entry.word}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2.5 mt-5 flex-wrap">
            {selDays.size > 0 && (
              <button onClick={startStudy} className="px-6 py-2.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.88rem] cursor-pointer transition-all shadow-[0_3px_12px_rgba(245,158,11,.35)] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(245,158,11,.5)]">
                🚀 开始今日学习
              </button>
            )}
            {doneDays.length > 0 && (
              <button onClick={resetProgress} className="px-5 py-2.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text-dim)] font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:border-[var(--wm-accent)] hover:text-[var(--wm-accent)]">
                🔄 重置进度
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // STUDY PHASE
  if (phase === 'study' && words[studyIdx]) {
    const w = words[studyIdx]
    const total = words.length
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-5">
        <div className="flex items-center gap-3 flex-wrap mb-0 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => setPhase('selector')} className="px-3.5 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito text-[.78rem] font-bold cursor-pointer transition-all shrink-0 hover:border-[var(--wm-accent4)] hover:text-[var(--wm-accent4)]">
              ← 返回
            </button>
            <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)]">📖 记忆单词</div>
          </div>
          <div className="text-[.72rem] font-bold text-[var(--wm-text-dim)] bg-[var(--wm-surface)] border border-[var(--wm-border)] px-2.5 py-1 rounded-full whitespace-nowrap">
            {studyIdx + 1} / {total}
          </div>
          <button
            onClick={() => { setStudyDefOnly(!studyDefOnly); setStudyWordVisible(false) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] cursor-pointer text-[.75rem] font-extrabold transition-all select-none whitespace-nowrap ${
              studyDefOnly ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]' : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            <span>✨</span> 仅看释义
            <div className={`w-7 h-3.5 rounded-[7px] relative transition-colors ${studyDefOnly ? 'bg-[rgba(245,158,11,.5)]' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-all ${studyDefOnly ? 'translate-x-3.5 bg-[#f59e0b]' : 'bg-white/40'}`} />
            </div>
          </button>
        </div>
        <div className="h-[3px] bg-white/[.04] rounded-sm mb-5">
          <div className="h-full bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24] rounded-sm transition-[width] duration-400" style={{ width: `${((studyIdx + 1) / total) * 100}%` }} />
        </div>

        <div className={`flex relative rounded-[16px] overflow-hidden border border-[var(--wm-border)] mb-0 ${studyDefOnly && !studyWordVisible ? 'min-h-[380px]' : 'min-h-[380px]'}`}
          style={{ height: 'calc(100vh - 220px)' }}
        >
          {/* Left */}
          <div className={`flex flex-col items-center justify-center px-7 py-8 gap-3 relative overflow-hidden transition-all duration-400 max-sm:w-full max-sm:min-h-[220px] ${
            studyDefOnly && !studyWordVisible ? 'w-0 opacity-0 overflow-hidden p-0 max-sm:h-0 max-sm:min-h-0' : 'w-1/2 opacity-100'
          }`} style={{ background: 'linear-gradient(135deg, #1a1a30 0%, #12122a 100%)' }}>
            <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 font-fredoka text-[min(35vw,240px)] text-white/[.022] leading-none pointer-events-none select-none">
              {w.entry.word.charAt(0).toUpperCase()}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center relative z-[1]">
              <span className={`px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider border ${
                w.isReview ? 'bg-[rgba(96,165,250,.2)] text-[#93c5fd] border-[rgba(96,165,250,.3)]' : 'bg-[rgba(249,115,22,.2)] text-[#fb923c] border-[rgba(249,115,22,.3)]'
              }`}>{w.isReview ? '复习' : '新词'}</span>
              <span className="px-2 py-0.5 rounded-full text-[.6rem] font-extrabold uppercase tracking-wider bg-[rgba(233,69,96,.2)] text-[var(--wm-accent)] border border-[rgba(233,69,96,.3)]">{w.entry.unit}</span>
            </div>
            <div className="font-nunito text-[clamp(2rem,5vw,3.5rem)] font-black text-center break-words leading-tight relative z-[1]">
              <PhonicsWord text={w.entry.word} />
            </div>
            {w.entry.ipa && <div className="text-[clamp(.85rem,1.8vw,1rem)] text-[var(--wm-accent2)] italic font-semibold opacity-85 relative z-[1]">{w.entry.ipa}</div>}
            {w.entry.example && (
              <div className="border-t border-white/[.07] pt-3 w-full text-center relative z-[1]">
                <div className="text-[.55rem] font-extrabold uppercase tracking-widest text-white/30 mb-1.5">例句</div>
                <div className="text-[.82rem] text-[rgba(200,200,255,.5)] italic leading-loose [&_strong]:text-[#4ade80] [&_strong]:not-italic [&_strong]:font-extrabold"
                  dangerouslySetInnerHTML={{ __html: highlightExample(w.entry.example, w.entry.word) }}
                />
              </div>
            )}
          </div>

          {/* Right */}
          <div
            onClick={() => { if (studyDefOnly) { setStudyWordVisible(!studyWordVisible) } }}
            className={`flex flex-col items-center justify-center px-7 py-8 relative transition-all duration-400 max-sm:w-full max-sm:min-h-[220px] ${
              studyDefOnly && !studyWordVisible ? 'w-full cursor-pointer' : studyDefOnly ? 'w-1/2 cursor-pointer' : 'w-1/2 cursor-default'
            }`}
            style={{ background: 'linear-gradient(135deg, #0e2a50 0%, #1a1a2e 100%)' }}
          >
            <div className="flex flex-col gap-2 items-start w-full max-w-[420px]">
              <div className="text-[.6rem] font-extrabold uppercase tracking-widest text-[rgba(96,165,250,.6)]">释义</div>
              <div className="text-[clamp(1rem,2.5vw,1.45rem)] font-bold leading-loose text-[#f0f0ff]"
                dangerouslySetInnerHTML={{ __html: hilite(w.entry.explanation, w.entry.word) }}
              />
            </div>
            {studyDefOnly && (
              <div className="absolute bottom-4 right-5 text-[.65rem] text-white/25 font-bold flex items-center gap-1">
                {studyWordVisible ? '点击隐藏单词' : '点击查看单词'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3.5 py-2">
          <button
            onClick={() => { if (studyIdx > 0) { setStudyIdx(studyIdx - 1); setStudyWordVisible(false) } }}
            disabled={studyIdx === 0}
            className="px-6 py-2.5 rounded-full border-[1.5px] border-white/10 bg-transparent text-white/40 font-nunito font-bold text-[.82rem] cursor-pointer transition-all hover:border-[#60a5fa] hover:text-[#93c5fd] disabled:opacity-20 disabled:cursor-default"
          >
            ← 上一个
          </button>
          <div className="text-[.78rem] font-bold text-white/30 min-w-[60px] text-center">{studyIdx + 1} / {total}</div>
          <button
            onClick={() => {
              if (studyIdx < total - 1) { setStudyIdx(studyIdx + 1); setStudyWordVisible(false) }
              else startQuiz()
            }}
            className="px-7 py-2.5 rounded-full border-0 bg-gradient-to-br from-[#d97706] to-[#f59e0b] text-white font-nunito font-extrabold text-[.82rem] cursor-pointer shadow-[0_3px_12px_rgba(217,119,6,.4)] hover:-translate-y-px"
          >
            {studyIdx === total - 1 ? '✅ 开始测试 →' : '下一个 →'}
          </button>
        </div>
      </div>
    )
  }

  // QUIZ PHASE
  if (phase === 'quiz' && quizQs[curQ]) {
    const q = quizQs[curQ]
    const total = quizQs.length
    const pool = vocab.filter(v => v.word !== q.word.word).sort(() => Math.random() - .5).slice(0, 3)
    const opts = [...pool, q.word].sort(() => Math.random() - .5)
    const badgeCls = q.type === 'A' ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]' : q.type === 'B' ? 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]' : 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
    const typeLabels: Record<string, string> = { A: '题型 A · 释义→选单词', B: '题型 B · 单词→选释义', C: '题型 C · 释义→默写' }

    return (
      <div className="max-w-[1280px] mx-auto px-4 py-5">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => { setStudyIdx(0); setStudyWordVisible(false); setPhase('study') }} className="px-3.5 py-1.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-full text-[var(--wm-text-dim)] font-nunito text-[.78rem] font-bold cursor-pointer shrink-0">
            ← 回到记忆
          </button>
          <div className="font-fredoka text-[1.1rem] text-[var(--wm-text)] flex-1">✏️ 单词测试</div>
          <div className="text-[.72rem] font-bold text-[var(--wm-text-dim)] bg-[var(--wm-surface)] border border-[var(--wm-border)] px-2.5 py-1 rounded-full">第{curQ + 1}题</div>
        </div>
        <div className="h-[3px] bg-white/[.04] rounded-sm mb-5">
          <div className="h-full bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24] rounded-sm transition-[width] duration-400" style={{ width: `${(curQ / total) * 100}%` }} />
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-[680px] bg-white/[.03] border border-white/[.07] rounded-[20px] p-6 flex flex-col gap-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <span className={`inline-block px-3 py-1 rounded-full text-[.65rem] font-extrabold uppercase tracking-wider ${badgeCls}`}>{typeLabels[q.type]}</span>
              <div className="text-[.78rem] font-extrabold text-[#4ade80]">✓ {score}</div>
            </div>

            <div className="text-[clamp(.95rem,2.5vw,1.4rem)] font-black leading-relaxed text-[#f0f0ff]">
              {q.type === 'B' ? <PhonicsWord text={q.word.word} /> : q.word.explanation}
            </div>
            {q.type === 'B' && q.word.ipa && <div className="text-[.78rem] text-white/[.38] font-semibold">{q.word.ipa}</div>}
            {q.type !== 'B' && q.word.ipa && <div className="text-[.78rem] text-white/[.38] font-semibold">音标：{q.word.ipa}</div>}

            {q.type !== 'C' && (
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
                {opts.map(o => {
                  const isCorrect = o.word === q.word.word
                  const isSel = selected === o.word
                  let cls = 'bg-white/[.04] border-white/[.09] text-[#f0f0ff]'
                  if (answered) {
                    if (isCorrect) cls = 'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80]'
                    else if (isSel) cls = 'border-[#f87171] bg-[rgba(248,113,113,.12)] text-[#f87171]'
                  }
                  return (
                    <button key={o.word} disabled={answered} onClick={() => handleMC(o.word, q.word.word)}
                      className={`px-3.5 py-3 border-2 rounded-xl font-nunito font-bold text-[.85rem] cursor-pointer transition-all text-left leading-snug break-words disabled:cursor-default ${cls}`}
                    >
                      {q.type === 'A' ? <PhonicsWord text={o.word} /> : o.explanation}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'C' && (
              <div className="flex flex-col gap-2.5">
                <input
                  ref={spellRef}
                  type="text"
                  value={spellVal}
                  onChange={e => setSpellVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSpell() }}
                  placeholder="请输入单词或短语…"
                  autoComplete="off"
                  className={`w-full p-3.5 bg-white/[.04] border-2 rounded-xl text-[#f0f0ff] font-nunito text-[1.25rem] font-bold text-center tracking-wider outline-none transition-colors focus:border-[#a78bfa] ${
                    spellOk === true ? 'border-[#4ade80] bg-[rgba(74,222,128,.08)]' :
                    spellOk === false ? 'border-[#f87171] bg-[rgba(248,113,113,.08)]' :
                    'border-white/[.09]'
                  }`}
                />
                {!answered && (
                  <button onClick={handleSpell} className="p-3 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] border-0 rounded-xl text-white font-nunito font-extrabold text-[.88rem] cursor-pointer">✓ 确认</button>
                )}
                {answered && spellOk !== null && (
                  <div className={`text-center text-[.85rem] font-bold p-2 rounded-lg ${spellOk ? 'bg-[rgba(74,222,128,.15)] text-[#4ade80]' : 'bg-[rgba(248,113,113,.15)] text-[#f87171]'}`}>
                    {spellOk ? '✓ 正确！' : <span>✗ 正确答案：<strong>{q.word.word}</strong></span>}
                  </div>
                )}
              </div>
            )}

            {answered && (
              <button onClick={nextQ} className="w-full p-3 bg-white/5 border-[1.5px] border-white/10 rounded-xl text-[var(--wm-text)] font-nunito font-bold text-[.85rem] cursor-pointer transition-all hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.08)]">
                下一题 →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // DONE PHASE
  if (phase === 'done') {
    const total = quizQs.length
    const pct = total ? Math.round(score / total * 100) : 0
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
    const msg = pct >= 90 ? '完美！' : pct >= 70 ? '太棒了！' : pct >= 50 ? '不错哦！' : '继续加油！'

    return (
      <div className="max-w-[500px] mx-auto py-10 px-5 text-center">
        <div className="text-[3.5rem] mb-3.5">{emoji}</div>
        <div className="font-fredoka text-[3rem] bg-gradient-to-br from-[#d97706] to-[#f59e0b] bg-clip-text text-transparent mb-1.5">
          {score} / {total}
        </div>
        <div className="text-[var(--wm-text-dim)] text-[.9rem] font-bold mb-2.5">{msg}</div>
        <div className="text-[.78rem] text-[var(--wm-text-dim)] leading-loose mb-5">
          正确率 {pct}% · {words.length} 个单词 · {[...selDays].sort((a, b) => a - b).map(d => 'Day ' + d).join(', ')}
        </div>
        <div className="flex gap-2.5 justify-center flex-wrap">
          <button onClick={() => startQuiz()} className="px-6 py-2.5 bg-gradient-to-br from-[#d97706] to-[#f59e0b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.88rem] cursor-pointer shadow-[0_3px_12px_rgba(245,158,11,.35)]">
            🔄 重新测试
          </button>
          <button onClick={() => setPhase('selector')} className="px-5 py-2.5 bg-transparent border-[1.5px] border-[var(--wm-border)] rounded-[10px] text-[var(--wm-text-dim)] font-nunito font-bold text-[.82rem] cursor-pointer">
            返回计划
          </button>
        </div>
      </div>
    )
  }

  return null
}
