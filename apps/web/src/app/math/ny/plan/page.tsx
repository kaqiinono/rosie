'use client'

import MathWeeklyPractice from '@rosie/math/components/MathWeeklyPractice'
import { PROBLEMS as G1Lesson12PROBLEMS } from '@rosie/math/utils/g1/lesson12-data'
import { PROBLEMS as G1Lesson13PROBLEMS } from '@rosie/math/utils/g1/lesson13-data'
import { PROBLEMS as G1Lesson15PROBLEMS } from '@rosie/math/utils/g1/lesson15-data'
import { PROBLEMS as G1Lesson18PROBLEMS } from '@rosie/math/utils/g1/lesson18-data'
import { PROBLEMS as G1Lesson23PROBLEMS } from '@rosie/math/utils/g1/lesson23-data'
import { PROBLEMS as G1Lesson29PROBLEMS } from '@rosie/math/utils/g1/lesson29-data'
import { PROBLEMS as G1Lesson30PROBLEMS } from '@rosie/math/utils/g1/lesson30-data'
import { PROBLEMS as G1Lesson34PROBLEMS } from '@rosie/math/utils/g1/lesson34-data'
import { PROBLEMS as G1Lesson35PROBLEMS } from '@rosie/math/utils/g1/lesson35-data'
import { PROBLEMS as G1Lesson36PROBLEMS } from '@rosie/math/utils/g1/lesson36-data'
import { PROBLEMS as G1Lesson37PROBLEMS } from '@rosie/math/utils/g1/lesson37-data'
import { PROBLEMS as G1Lesson38PROBLEMS } from '@rosie/math/utils/g1/lesson38-data'
import { PROBLEMS as G1Lesson39PROBLEMS } from '@rosie/math/utils/g1/lesson39-data'
import { PROBLEMS as G1Lesson40PROBLEMS } from '@rosie/math/utils/g1/lesson40-data'
import { PROBLEMS as G1Lesson41PROBLEMS } from '@rosie/math/utils/g1/lesson41-data'
import { PROBLEMS as G1Lesson42PROBLEMS } from '@rosie/math/utils/g1/lesson42-data'
import { PROBLEMS as G1Lesson43PROBLEMS } from '@rosie/math/utils/g1/lesson43-data'
import { PROBLEMS as G1Lesson44PROBLEMS } from '@rosie/math/utils/g1/lesson44-data'
import { PROBLEMS as G1Lesson46PROBLEMS } from '@rosie/math/utils/g1/lesson46-data'
import { PROBLEMS as G1Lesson47PROBLEMS } from '@rosie/math/utils/g1/lesson47-data'
import { PROBLEMS as G2Lesson1PROBLEMS } from '@rosie/math/utils/g2/lesson1-data'
import { PROBLEMS as G2Lesson6PROBLEMS } from '@rosie/math/utils/g2/lesson6-data'
import { PROBLEMS as G2Lesson7PROBLEMS } from '@rosie/math/utils/g2/lesson7-data'
import { PROBLEMS as G2Lesson5PROBLEMS } from '@rosie/math/utils/g2/lesson5-data'
import { PROBLEMS as G2Lesson4PROBLEMS } from '@rosie/math/utils/g2/lesson4-data'
import { PROBLEMS as G2Lesson3PROBLEMS } from '@rosie/math/utils/g2/lesson3-data'
import { PROBLEMS as G2Lesson2PROBLEMS } from '@rosie/math/utils/g2/lesson2-data'
import type { ProblemSet } from '@rosie/core'
import Link from 'next/link'

const PROBLEM_SETS: Record<string, ProblemSet> = {
  '1-12': G1Lesson12PROBLEMS,
  '1-13': G1Lesson13PROBLEMS,
  '1-15': G1Lesson15PROBLEMS,
  '1-18': G1Lesson18PROBLEMS,
  '1-23': G1Lesson23PROBLEMS,
  '1-29': G1Lesson29PROBLEMS,
  '1-30': G1Lesson30PROBLEMS,
  '1-34': G1Lesson34PROBLEMS,
  '1-35': G1Lesson35PROBLEMS,
  '1-36': G1Lesson36PROBLEMS,
  '1-37': G1Lesson37PROBLEMS,
  '1-38': G1Lesson38PROBLEMS,
  '1-39': G1Lesson39PROBLEMS,
  '1-40': G1Lesson40PROBLEMS,
  '1-41': G1Lesson41PROBLEMS,
  '1-42': G1Lesson42PROBLEMS,
  '1-43': G1Lesson43PROBLEMS,
  '1-44': G1Lesson44PROBLEMS,
  '1-46': G1Lesson46PROBLEMS,
  '1-47': G1Lesson47PROBLEMS,
  '2-1': G2Lesson1PROBLEMS,
  '2-2': G2Lesson2PROBLEMS,
  '2-6': G2Lesson6PROBLEMS,
  '2-7': G2Lesson7PROBLEMS,
  '2-5': G2Lesson5PROBLEMS,
  '2-4': G2Lesson4PROBLEMS,
  '2-3': G2Lesson3PROBLEMS,
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
