'use client'

import Link from 'next/link'
import TodayDashboard from '@/components/today/TodayDashboard'

function todayLabel() {
  const d = new Date()
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${months[d.getMonth()]}${d.getDate()}日 ${days[d.getDay()]}`
}

export default function TodayPage() {
  const label = todayLabel()

  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: 'linear-gradient(160deg, #f0fdf4 0%, #fff7ed 35%, #fef3c7 65%, #f0f9ff 100%)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Floating bg dots */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[6%] left-[8%] h-32 w-32 rounded-full blur-3xl opacity-30" style={{ background: '#fbbf24' }} />
        <div className="absolute top-[20%] right-[6%] h-24 w-24 rounded-full blur-3xl opacity-20" style={{ background: '#10b981' }} />
        <div className="absolute top-[55%] left-[4%] h-20 w-20 rounded-full blur-3xl opacity-15" style={{ background: '#6366f1' }} />
        <div className="absolute bottom-[15%] right-[10%] h-28 w-28 rounded-full blur-3xl opacity-20" style={{ background: '#f97316' }} />
      </div>

      {/* Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(255,252,245,0.90)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1.5px solid rgba(251,146,60,.15)',
          boxShadow: '0 2px 16px rgba(251,146,60,.08)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full no-underline transition-all hover:scale-105 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
            style={{ background: 'rgba(251,146,60,.1)', border: '1.5px solid rgba(251,146,60,.25)', color: '#c2410c' }}
          >
            <span className="text-[14px] font-bold leading-none">←</span>
            <span className="hidden text-[12px] font-bold sm:inline">首页</span>
          </Link>

          <div className="flex flex-1 items-center gap-2">
            <span className="animate-wiggle inline-block text-xl">🗓️</span>
            <div>
              <div
                className="text-[17px] font-extrabold leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #ea580c, #f59e0b, #10b981)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                今日计划
              </div>
              <div className="text-[10px] font-semibold text-text-muted leading-none">{label}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative pt-5">
        <TodayDashboard />
      </div>
    </div>
  )
}
