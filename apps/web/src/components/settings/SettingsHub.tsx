'use client'

import Link from 'next/link'
import { isAdminUser, useAuth } from '@rosie/core'

interface SettingTool {
  href: string
  emoji: string
  title: string
  description: string
  from: string
  to: string
  ring: string
}

const PERSONAL_TOOLS: SettingTool[] = [
  {
    href: '/setting/awards', emoji: '🎁', title: '星星与奖券',
    description: '调整当前账户的三色星星余额、赠送兑换券并查看今日操作日志。',
    from: 'rgba(251,191,36,0.16)', to: 'rgba(244,63,94,0.10)', ring: 'rgba(245,158,11,0.30)',
  },
  {
    href: '/setting/plans', emoji: '🗂️', title: '计划中心',
    description: '为当前账户创建与修改数学、英语和语文学习计划。',
    from: 'rgba(249,115,22,0.14)', to: 'rgba(251,191,36,0.10)', ring: 'rgba(249,115,22,0.28)',
  },
  {
    href: '/setting/calc', emoji: '🧮', title: '口算设置',
    description: '选择题型与题量、计时模式、音效与答题偏好。',
    from: 'rgba(139,92,246,0.14)', to: 'rgba(236,72,153,0.10)', ring: 'rgba(139,92,246,0.28)',
  },
  {
    href: '/setting/audio', emoji: '🎧', title: '媒体收藏夹',
    description: '管理当前账户的“我的最爱”和自建媒体收藏夹。',
    from: 'rgba(34,197,94,0.14)', to: 'rgba(59,130,246,0.10)', ring: 'rgba(34,197,94,0.28)',
  },
]

export const ADMIN_TOOLS: SettingTool[] = [
  { href: '/admin/users', emoji: '👥', title: '用户管理', description: '管理账户邮箱、管理员权限、密码重置和用户注销。', from: 'rgba(99,102,241,0.14)', to: 'rgba(168,85,247,0.10)', ring: 'rgba(99,102,241,0.28)' },
  { href: '/admin/voucher-templates', emoji: '🎟️', title: '奖券模板', description: '创建、修改、下架和恢复全局兑换券模板。', from: 'rgba(251,191,36,0.16)', to: 'rgba(244,63,94,0.10)', ring: 'rgba(245,158,11,0.30)' },
  { href: '/admin/words', emoji: '📚', title: '词库管理', description: '创建词库并按 Unit / Lesson 增删改查单词。', from: 'rgba(59,130,246,0.14)', to: 'rgba(16,185,129,0.10)', ring: 'rgba(59,130,246,0.28)' },
  { href: '/admin/word-images', emoji: '🖼️', title: '单词配图', description: '为词库自动匹配图片、查看匹配度并人工换图或上传。', from: 'rgba(52,211,153,0.14)', to: 'rgba(96,165,250,0.10)', ring: 'rgba(52,211,153,0.28)' },
  { href: '/admin/chinese', emoji: '字', title: '语文字词', description: '维护生字拼音、部首、组词与课文词语。', from: 'rgba(244,63,94,0.12)', to: 'rgba(251,191,36,0.10)', ring: 'rgba(244,63,94,0.28)' },
  { href: '/admin/audio', emoji: '🎬', title: '公共媒体管理', description: '上传、修改和删除公共音频与视频资源。', from: 'rgba(168,85,247,0.14)', to: 'rgba(236,72,153,0.10)', ring: 'rgba(168,85,247,0.28)' },
  { href: '/admin/math', emoji: '📐', title: '数学题管理', description: '管理题解图、题面图与富文本笔记。', from: 'rgba(13,148,136,0.14)', to: 'rgba(59,130,246,0.08)', ring: 'rgba(13,148,136,0.28)' },
  { href: '/admin/math-lesson-id-audit', emoji: '🔀', title: '讲次 ID 迁移审计', description: '扫描 legacy → lessonKey 迁移影响的数据、冲突与引用。', from: 'rgba(99,102,241,0.14)', to: 'rgba(14,165,233,0.10)', ring: 'rgba(99,102,241,0.28)' },
  { href: '/admin/word-audit', emoji: '🔍', title: '单词审计', description: '检查数据库词条的缺漏与空字段并导出报告。', from: 'rgba(20,184,166,0.14)', to: 'rgba(59,130,246,0.08)', ring: 'rgba(20,184,166,0.28)' },
]

function ToolGrid({ tools }: { tools: SettingTool[] }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{tools.map((tool) => (
    <Link key={tool.href} href={tool.href} className="group relative overflow-hidden rounded-3xl bg-white/85 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ border: `1.5px solid ${tool.ring}` }}>
      <div className="absolute inset-0 opacity-70 transition group-hover:opacity-100" style={{ background: `linear-gradient(150deg, ${tool.from}, ${tool.to})` }} aria-hidden />
      <div className="relative flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-[30px] shadow-sm">{tool.emoji}</div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h3 className="text-[16px] font-extrabold text-slate-800">{tool.title}</h3><span className="text-slate-400 transition group-hover:translate-x-0.5">→</span></div><p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{tool.description}</p></div>
      </div>
    </Link>
  ))}</div>
}

export function AdminSettingsCards() {
  return <ToolGrid tools={ADMIN_TOOLS} />
}

export default function SettingsHub() {
  const { user } = useAuth()
  const admin = isAdminUser(user)
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}>
      <header className="sticky top-0 z-30 border-b border-amber-200/40 bg-white/85 backdrop-blur"><div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4"><Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/10 text-amber-700" aria-label="返回首页">←</Link><div className="text-[17px] font-extrabold text-amber-900">⚙️ 用户配置</div></div></header>
      <main className="mx-auto max-w-[860px] space-y-10 px-4 py-8 pb-20">
        <section><h1 className="text-[22px] font-black text-slate-800">个人配置</h1><p className="mb-5 mt-1 text-[13px] text-slate-500">仅修改当前登录账户的学习与使用配置</p><ToolGrid tools={PERSONAL_TOOLS} /></section>
        {admin && <section><div className="mb-5"><h2 className="text-[22px] font-black text-slate-800">全局配置</h2><p className="mt-1 text-[13px] text-slate-500">管理员专用 · 管理全局内容和账户</p></div><AdminSettingsCards /></section>}
      </main>
    </div>
  )
}
