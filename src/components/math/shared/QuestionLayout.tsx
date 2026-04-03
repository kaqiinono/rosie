'use client'

import React, { useState, useRef, useEffect } from 'react'

interface QuestionLayoutProps {
  question: React.ReactNode
  solution: React.ReactNode
  answer: React.ReactNode
}

export default function QuestionLayout({ question, solution, answer }: QuestionLayoutProps) {
  const [solutionOpen, setSolutionOpen] = useState(false)
  const solutionRef = useRef<HTMLDivElement>(null)
  const [solutionHeight, setSolutionHeight] = useState(0)

  useEffect(() => {
    if (solutionRef.current) {
      setSolutionHeight(solutionRef.current.scrollHeight)
    }
  }, [solution, solutionOpen])

  return (
    <div className="question-layout">
      {/* ── Section 1: 题目 ── */}
      <section className="ql-question">
        <div className="ql-question-body">{question}</div>

        {/* Toggle 按钮 */}
        <div style={{ width: '100%', textAlign: 'right' }}>
          <button
            className={`ql-toggle-btn ${solutionOpen ? 'ql-toggle-btn--open' : ''}`}
            onClick={() => setSolutionOpen((v) => !v)}
            aria-expanded={solutionOpen}
          >
            <span className="ql-toggle-text">{solutionOpen ? '收起题解' : '查看题解'}</span>
            <span className="ql-toggle-icon" aria-hidden="true">
              {solutionOpen ? '▲' : '▼'}
            </span>
          </button>
        </div>
      </section>

      {/* ── Section 2: 题解（折叠动画） ── */}
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

      {/* ── Section 3: 答案 ── */}
      <section className="ql-answer">
        <div className="ql-answer-body">{answer}</div>
      </section>

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
          background: #fafaf9;
          border-bottom: 1.5px solid #f0ede8;
        }
        .ql-question-body {
          font-size: 17px;
          line-height: 1.75;
          color: #1a1a1a;
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
          border-bottom: 1.5px solid #f5e8c0;
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

        /* ─── 深色模式适配 ─── */
        @media (prefers-color-scheme: dark) {
          .question-layout {
            background: #1c1c1e;
            box-shadow:
              0 2px 8px rgba(0,0,0,0.3),
              0 0 0 1.5px rgba(255,255,255,0.06);
          }
          .ql-question { background: #232325; border-bottom-color: #2e2e30; }
          .ql-question-body { color: #f0ede8; }
          .ql-toggle-btn { background: #2e2940; border-color: #5040a0; color: #b8a8ff; }
          .ql-toggle-btn:hover { background: #3a3355; }
          .ql-toggle-btn--open { background: #6c4fff; border-color: #6c4fff; color: #fff; }
          .ql-solution { background: #26231a; border-bottom-color: #3a3222; }
          .ql-solution-body { color: #e8d8a0; }
          .ql-answer { background: #1a2420; }
          .ql-answer-body { color: #7adea8; }
          .ql-section-label { color: #606060; }
        }

        /* ─── 移动端 ─── */
        @media (max-width: 480px) {
          .ql-question, .ql-answer { padding: 18px 18px 16px; }
          .ql-solution-inner { padding: 16px 18px 14px; }
          .ql-question-body { font-size: 15px; }
          .ql-solution-body { font-size: 14px; }
          .ql-answer-body { font-size: 14.5px; }
        }
      `}</style>
    </div>
  )
}
