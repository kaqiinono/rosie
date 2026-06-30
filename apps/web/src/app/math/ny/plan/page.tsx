'use client'

import MathWeeklyPractice from '@rosie/math/components/MathWeeklyPractice'
import { PROBLEMS as PROBLEMS12 } from '@rosie/math/utils/lesson12-data'
import { PROBLEMS as PROBLEMS13 } from '@rosie/math/utils/lesson13-data'
import { PROBLEMS as PROBLEMS15 } from '@rosie/math/utils/lesson15-data'
import { PROBLEMS as PROBLEMS18 } from '@rosie/math/utils/lesson18-data'
import { PROBLEMS as PROBLEMS23 } from '@rosie/math/utils/lesson23-data'
import { PROBLEMS as PROBLEMS29 } from '@rosie/math/utils/lesson29-data'
import { PROBLEMS as PROBLEMS30 } from '@rosie/math/utils/lesson30-data'
import { PROBLEMS as PROBLEMS34 } from '@rosie/math/utils/lesson34-data'
import { PROBLEMS as PROBLEMS35 } from '@rosie/math/utils/lesson35-data'
import { PROBLEMS as PROBLEMS36 } from '@rosie/math/utils/lesson36-data'
import { PROBLEMS as PROBLEMS37 } from '@rosie/math/utils/lesson37-data'
import { PROBLEMS as PROBLEMS38 } from '@rosie/math/utils/lesson38-data'
import { PROBLEMS as PROBLEMS39 } from '@rosie/math/utils/lesson39-data'
import { PROBLEMS as PROBLEMS40 } from '@rosie/math/utils/lesson40-data'
import { PROBLEMS as PROBLEMS41 } from '@rosie/math/utils/lesson41-data'
import { PROBLEMS as PROBLEMS42 } from '@rosie/math/utils/lesson42-data'
import { PROBLEMS as PROBLEMS43 } from '@rosie/math/utils/lesson43-data'
import { PROBLEMS as PROBLEMS44 } from '@rosie/math/utils/lesson44-data'
import { PROBLEMS as PROBLEMS46 } from '@rosie/math/utils/lesson46-data'
import { PROBLEMS as PROBLEMS47 } from '@rosie/math/utils/lesson47-data'
import { PROBLEMS as PROBLEMS49 } from '@rosie/math/utils/lesson49-data'
import type { ProblemSet } from '@rosie/core'
import Link from 'next/link'

const PROBLEM_SETS: Record<string, ProblemSet> = {
  '12': PROBLEMS12,
  '13': PROBLEMS13,
  '15': PROBLEMS15,
  '18': PROBLEMS18,
  '23': PROBLEMS23,
  '29': PROBLEMS29,
  '30': PROBLEMS30,
  '34': PROBLEMS34,
  '35': PROBLEMS35,
  '36': PROBLEMS36,
  '37': PROBLEMS37,
  '38': PROBLEMS38,
  '39': PROBLEMS39,
  '40': PROBLEMS40,
  '41': PROBLEMS41,
  '42': PROBLEMS42,
  '43': PROBLEMS43,
  '44': PROBLEMS44,
  '46': PROBLEMS46,
  '47': PROBLEMS47,
  '49': PROBLEMS49,
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
        <div
          className="animate-bounce-slow absolute top-[8%] left-[5%] text-4xl opacity-20"
          style={{ animationDelay: '0s' }}
        >
          ⭐
        </div>
        <div
          className="animate-bounce-slow absolute top-[15%] right-[8%] text-3xl opacity-15"
          style={{ animationDelay: '-1.5s' }}
        >
          🌟
        </div>
        <div
          className="animate-bounce-slow absolute top-[45%] left-[3%] text-2xl opacity-10"
          style={{ animationDelay: '-0.8s' }}
        >
          ✨
        </div>
        <div
          className="animate-bounce-slow absolute top-[60%] right-[5%] text-3xl opacity-12"
          style={{ animationDelay: '-2s' }}
        >
          💫
        </div>
        <div
          className="animate-bounce-slow absolute top-[80%] left-[10%] text-2xl opacity-10"
          style={{ animationDelay: '-1.2s' }}
        >
          🌈
        </div>
        <div
          className="animate-bounce-slow absolute right-[12%] bottom-[10%] text-3xl opacity-15"
          style={{ animationDelay: '-3s' }}
        >
          🎯
        </div>
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
            style={{
              background: 'rgba(251,146,60,.12)',
              border: '1.5px solid rgba(251,146,60,.3)',
              color: '#c2410c',
            }}
          >
            <span className="text-[14px] leading-none font-bold">←</span>
            <span className="hidden text-[12px] font-bold sm:inline">返回</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="animate-wiggle inline-block text-2xl">⭐</span>
            <span
              className="text-[18px] font-extrabold"
              style={{
                background: 'linear-gradient(135deg, #ea580c, #f59e0b, #f97316)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
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
