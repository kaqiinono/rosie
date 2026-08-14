'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Problem } from '@rosie/core'
import ProblemNotesPanel from '@rosie/math-kit/components/shared/ProblemNotesPanel'

type SolutionToggleContextValue = {
  node: React.ReactNode
  /** Registers a renderer of the toggle; returns the unregister function. */
  claim: () => () => void
}

const SolutionToggleContext = createContext<SolutionToggleContextValue | null>(null)

/**
 * Place the 查看题解 control next to 检查答案 (or other answer actions).
 * Pass `claim: true` only from the component that will render the control,
 * so QuestionLayout can hide its fallback row.
 */
export function useClaimSolutionToggle(claim = true): React.ReactNode {
  const ctx = useContext(SolutionToggleContext)
  useLayoutEffect(() => {
    if (!claim || !ctx?.node) return
    return ctx.claim()
  }, [claim, ctx])
  return ctx?.node ?? null
}

interface QuestionLayoutProps {
  question: React.ReactNode
  solution: React.ReactNode
  answer: React.ReactNode
  defaultSolutionOpen?: boolean
  /**
   * When false, hides the 查看题解 toggle until the first answer attempt.
   * Practice and lesson detail should pass `hasAttempted`; defaults to true for legacy pages.
   */
  solutionAvailable?: boolean
  /**
   * When false, keeps the solution panel (if available) but hides 查看/收起题解.
   * Used after 不会 when 题解 is already open and 下一题 replaces the toggle.
   */
  showSolutionToggle?: boolean
  /** When set, loads DB-backed notes for this problem below the answer area. */
  problemId?: string
  /** Enables in-place note editing on problem detail for logged-in users. */
  problem?: Problem
}

export default function QuestionLayout({
  question,
  solution,
  answer,
  defaultSolutionOpen = false,
  solutionAvailable = true,
  showSolutionToggle = true,
  problemId,
  problem,
}: QuestionLayoutProps) {
  const [solutionOpen, setSolutionOpen] = useState(defaultSolutionOpen && solutionAvailable)
  const solutionRef = useRef<HTMLDivElement>(null)
  const [solutionHeight, setSolutionHeight] = useState(0)
  // Reference-counted rather than a boolean reset by an effect: the claim happens in a
  // child's layout effect while any reset would run in the parent's, which always comes
  // later — so a boolean settles on "unclaimed" and the fallback row renders a second
  // 查看题解 button next to the claimed one.
  const [claimCount, setClaimCount] = useState(0)
  const toggleClaimed = claimCount > 0

  useEffect(() => {
    setSolutionOpen(solutionAvailable ? defaultSolutionOpen : false)
  }, [defaultSolutionOpen, solutionAvailable])

  useEffect(() => {
    const el = solutionRef.current
    if (!el || !solutionOpen) return

    const measure = () => {
      const nextHeight = el.scrollHeight
      setSolutionHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(el)

    const onImageLoad = () => measure()
    el.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', onImageLoad)
    })

    return () => {
      ro.disconnect()
      el.querySelectorAll('img').forEach((img) => img.removeEventListener('load', onImageLoad))
    }
  }, [problemId, solutionOpen])

  const claim = useCallback(() => {
    setClaimCount((c) => c + 1)
    return () => setClaimCount((c) => c - 1)
  }, [])

  const toggleEnabled = solutionAvailable && showSolutionToggle

  const toggleCtx = useMemo((): SolutionToggleContextValue | null => {
    if (!toggleEnabled) return null
    return {
      claim,
      node: (
        <button
          type="button"
          className={`ql-toggle-btn ${solutionOpen ? 'ql-toggle-btn--open' : ''}`}
          onClick={() => setSolutionOpen((v) => !v)}
          aria-expanded={solutionOpen}
        >
          <span className="ql-toggle-text">{solutionOpen ? '收起题解' : '查看题解'}</span>
          <span className="ql-toggle-icon" aria-hidden="true">
            {solutionOpen ? '▲' : '▼'}
          </span>
        </button>
      ),
    }
  }, [toggleEnabled, solutionOpen, claim])

  const toggleButton = toggleCtx?.node ?? null

  return (
    <SolutionToggleContext.Provider value={toggleCtx}>
      <div className="question-layout">
        {/* ── Section 1: 题目 ── */}
        <section className="ql-question">
          <div className="ql-question-body">{question}</div>
        </section>

        {/* ── Section 2: 答案（查看题解紧挨检查答案，由 NumericAnswerPanel 认领） ── */}
        <section className="ql-answer">
          <div className="ql-answer-body">{answer}</div>
          {toggleEnabled && !toggleClaimed ? (
            <div className="ql-toggle-row">{toggleButton}</div>
          ) : null}
        </section>

        {/* ── Section 3: 题解（答题区下方折叠展开） ── */}
        {solutionAvailable ? (
          <section
            className="ql-solution"
            style={{
              maxHeight: solutionOpen ? `${solutionHeight}px` : '0px',
            }}
            aria-hidden={!solutionOpen}
          >
            <div className="ql-solution-inner" ref={solutionRef}>
              <div className="ql-solution-body">{solution}</div>
            </div>
          </section>
        ) : null}

        {problemId ? <ProblemNotesPanel problemId={problemId} problem={problem} /> : null}

        <style>{`
        /* ─── 容器 ─── */
        .question-layout {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 100%;
          min-width: 300px;
          margin: 0 auto;
          border-radius: 18px;
          overflow: hidden;
          box-shadow:
            0 2px 8px rgba(0,0,0,0.06),
            0 0 0 1.5px rgba(0,0,0,0.06);
          background: #ffffff;
        }

        /* ─── Section 共有 ─── */
        .ql-question,
        .ql-answer {
          padding: 24px 28px 20px;
        }

        /* ─── 标签行 ─── */
        .ql-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #a0a0a0;
          margin-bottom: 14px;
        }

        .ql-label-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #c8bfff;
          flex-shrink: 0;
        }
        .ql-label-dot--solution { background: #ffd07a; }
        .ql-label-dot--answer   { background: #7adea8; }

        /* ─── 题目区 ─── */
        .ql-question {
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: #fafaf9;
          border-bottom: 1.5px solid #f0ede8;
        }
        .ql-question-body {
          font-size: 17px;
          line-height: 1.75;
          color: #1a1a1a;
        }
        .ql-toggle-row {
          width: 100%;
          margin-top: 12px;
          text-align: right;
          flex-shrink: 0;
        }

        /* ─── Toggle 按钮 ─── */
        .ql-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px 7px 14px;
          border-radius: 999px;
          border: 1.5px solid #d6ceff;
          background: #f3f0ff;
          color: #6c4fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, transform 0.12s;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .ql-toggle-btn:hover {
          background: #ebe5ff;
          border-color: #b8a8ff;
        }
        .ql-toggle-btn:active {
          transform: scale(0.96);
        }
        .ql-toggle-btn--open {
          background: #6c4fff;
          border-color: #6c4fff;
          color: #fff;
        }
        .ql-toggle-btn--open:hover {
          background: #5a3ee8;
          border-color: #5a3ee8;
        }

        .ql-toggle-icon {
          font-size: 10px;
          line-height: 1;
          transition: transform 0.22s;
          display: inline-block;
        }

        /* ─── 题解区（折叠动画） ─── */
        .ql-solution {
          overflow: hidden;
          transition: max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1);
          background: #fffdf4;
          border-top: 1.5px solid #f5e8c0;
        }
        .ql-solution-inner {
          padding: 22px 28px 20px;
        }
        .ql-solution-body {
          font-size: 15.5px;
          line-height: 1.8;
          color: #3a3222;
        }

        /* ─── 答案区 ─── */
        .ql-answer {
          background: #f3fff8;
        }
        .ql-answer-body {
          font-size: 16px;
          line-height: 1.75;
          color: #1a3328;
          font-weight: 500;
        }

        /* ─── 移动端 ─── */
        @media (max-width: 480px) {
          .ql-question, .ql-answer { padding: 18px 18px 16px; }
          .ql-question { gap: 16px; }
          .ql-solution-inner { padding: 16px 18px 14px; }
          .ql-question-body { font-size: 15px; }
          .ql-solution-body { font-size: 14px; }
          .ql-answer-body { font-size: 14.5px; }
        }
      `}</style>
      </div>
    </SolutionToggleContext.Provider>
  )
}
