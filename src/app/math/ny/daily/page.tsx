'use client'

import MathWeeklyPractice from '@/components/math/MathWeeklyPractice'
import { PROBLEMS as PROBLEMS35 } from '@/utils/lesson35-data'
import { PROBLEMS as PROBLEMS36 } from '@/utils/lesson36-data'
import type { ProblemSet } from '@/utils/type'
import Link from 'next/link'

const PROBLEM_SETS: Record<string, ProblemSet> = {
  '35': PROBLEMS35,
  '36': PROBLEMS36,
}

export default function MathDailyPage() {
  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e0 30%, #fef9ec 60%, #f0f9ff 100%)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Floating decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[8%] left-[5%] text-4xl opacity-20 animate-bounce-slow" style={{ animationDelay: '0s' }}>⭐</div>
        <div className="absolute top-[15%] right-[8%] text-3xl opacity-15 animate-bounce-slow" style={{ animationDelay: '-1.5s' }}>🌟</div>
        <div className="absolute top-[45%] left-[3%] text-2xl opacity-10 animate-bounce-slow" style={{ animationDelay: '-0.8s' }}>✨</div>
        <div className="absolute top-[60%] right-[5%] text-3xl opacity-12 animate-bounce-slow" style={{ animationDelay: '-2s' }}>💫</div>
        <div className="absolute top-[80%] left-[10%] text-2xl opacity-10 animate-bounce-slow" style={{ animationDelay: '-1.2s' }}>🌈</div>
        <div className="absolute bottom-[10%] right-[12%] text-3xl opacity-15 animate-bounce-slow" style={{ animationDelay: '-3s' }}>🎯</div>
      </div>

      {/* Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,248,240,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '2px solid rgba(251,146,60,.2)',
          boxShadow: '0 2px 20px rgba(251,146,60,.1)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3 px-4">
          <Link
            href="/math"
            className="flex h-9 w-9 items-center justify-center rounded-full no-underline transition-all hover:scale-105 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
            style={{ background: 'rgba(251,146,60,.12)', border: '1.5px solid rgba(251,146,60,.3)', color: '#c2410c' }}
          >
            <span className="text-[14px] font-bold leading-none">←</span>
            <span className="hidden text-[12px] font-bold sm:inline">返回</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-2xl animate-wiggle inline-block">⭐</span>
            <span
              className="text-[18px] font-extrabold"
              style={{ background: 'linear-gradient(135deg, #ea580c, #f59e0b, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              数学每日一练
            </span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[800px]">
        <MathWeeklyPractice problemSets={PROBLEM_SETS} />
      </div>
    </div>
  )
}
