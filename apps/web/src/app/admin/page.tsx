'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'

interface AdminTool {
  href: string
  emoji: string
  title: string
  description: string
  /** card accent gradient + ring */
  from: string
  to: string
  ring: string
}

const TOOLS: AdminTool[] = [
  {
    href: '/admin/awards',
    emoji: '🎁',
    title: '星星与奖券',
    description: '调整三色星星余额、赠送兑换券、管理兑换券模版，查看今日操作日志。',
    from: 'rgba(251,191,36,0.16)',
    to: 'rgba(244,63,94,0.10)',
    ring: 'rgba(245,158,11,0.30)',
  },
  {
    href: '/admin/words',
    emoji: '📚',
    title: '词库管理',
    description: '创建词库，按 Unit / Lesson 增删改查单词，支持单个添加（可 AI 自动填充）与批量导入。',
    from: 'rgba(59,130,246,0.14)',
    to: 'rgba(16,185,129,0.10)',
    ring: 'rgba(59,130,246,0.28)',
  },
  {
    href: '/admin/chinese',
    emoji: '字',
    title: '语文字词',
    description: '维护生字拼音、部首、组词与课文「读一读记一记」词语；笔顺数据仍通过 SQL 脚本更新。',
    from: 'rgba(244,63,94,0.12)',
    to: 'rgba(251,191,36,0.10)',
    ring: 'rgba(244,63,94,0.28)',
  },
  {
    href: '/admin/audio',
    emoji: '🎬',
    title: '媒体管理',
    description: '管理阅读朗读、绘本音频，上传独立音频视频，收藏夹循环播放。',
    from: 'rgba(168,85,247,0.14)',
    to: 'rgba(236,72,153,0.10)',
    ring: 'rgba(168,85,247,0.28)',
  },
  {
    href: '/admin/math-images',
    emoji: '📐',
    title: '数学题管理',
    description: '按讲次与题号管理题解图、题面图与富文本笔记，支持 PDF 分片匹配上传。',
    from: 'rgba(13,148,136,0.14)',
    to: 'rgba(59,130,246,0.08)',
    ring: 'rgba(13,148,136,0.28)',
  },
  {
    href: '/admin/word-audit',
    emoji: '🔍',
    title: '单词审计',
    description: '对比本地数据文件与数据库 word_entries，检查缺漏单词与空字段，导出 JSON 报告。',
    from: 'rgba(20,184,166,0.14)',
    to: 'rgba(59,130,246,0.08)',
    ring: 'rgba(20,184,166,0.28)',
  },
]

export default function AdminHomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
            aria-label="返回首页"
          >
            ←
          </Link>
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-900">
            <span aria-hidden>🛠</span>
            <span>管理后台</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 py-8 pb-20">
        <div className="mb-6">
          <h1 className="text-[22px] font-black text-slate-800">选择一个管理工具</h1>
          <p className="mt-1 text-[13px] text-slate-500">家长 / 管理员专用 · 点击卡片进入对应子页面</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group relative overflow-hidden rounded-3xl bg-white/85 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ border: `1.5px solid ${t.ring}` }}
            >
              <div
                className="absolute inset-0 opacity-70 transition group-hover:opacity-100"
                style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}
                aria-hidden
              />
              <div className="relative flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[30px]"
                  style={{ background: 'rgba(255,255,255,0.75)', boxShadow: '0 2px 10px rgba(15,23,42,0.10)' }}
                >
                  {t.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[16px] font-extrabold text-slate-800">{t.title}</h2>
                    <span className="text-slate-400 transition group-hover:translate-x-0.5">→</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{t.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
