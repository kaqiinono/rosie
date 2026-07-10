'use client'

import { useAuth } from '@rosie/core'
import { useEnglishWrong } from '../hooks/useEnglishWrong'
import { useWordData } from '../hooks/useWordData'
import EnglishQuickLinkCard from './EnglishQuickLinkCard'

const BASE = '/english/words'

const STATIC_LINKS = [
  {
    href: `${BASE}/cards`,
    icon: '🃏',
    label: '单词',
    description: '单词卡片 · 翻转记忆 · 沉浸浏览',
    gradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fce7f3 100%)',
    border: 'rgba(233,69,96,.35)',
    shadow: '0 4px 20px rgba(233,69,96,.12)',
    text: '#9f1239',
  },
  {
    href: `${BASE}/practice`,
    icon: '✏️',
    label: '练习',
    description: '选择题 · 拼写 · 多种题型',
    gradient: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #ede9fe 100%)',
    border: 'rgba(168,85,247,.35)',
    shadow: '0 4px 20px rgba(168,85,247,.12)',
    text: '#6b21a8',
  },
  {
    href: `${BASE}/daily`,
    icon: '📅',
    label: '计划',
    description: '每日新词 · 周计划 · 进度追踪',
    gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0f2fe 100%)',
    border: 'rgba(59,130,246,.35)',
    shadow: '0 4px 20px rgba(59,130,246,.12)',
    text: '#1e40af',
  },
  {
    href: `${BASE}/reading`,
    icon: '📖',
    label: '阅读',
    description: '课文朗读 · 生词点读 · 回忆测验',
    gradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #ccfbf1 100%)',
    border: 'rgba(16,185,129,.35)',
    shadow: '0 4px 20px rgba(16,185,129,.12)',
    text: '#047857',
  },
] as const

export default function EnglishQuickLinkGrid() {
  const { user } = useAuth()
  const { wrongKeys } = useEnglishWrong(user)
  const { vocab } = useWordData(user)
  const hardCount = wrongKeys.size

  return (
    <div className="grid grid-cols-2 items-stretch gap-4 min-[501px]:gap-5 min-[768px]:grid-cols-3">
      {STATIC_LINKS.map(link => (
        <EnglishQuickLinkCard key={link.href} {...link} />
      ))}
      <EnglishQuickLinkCard
        href={`${BASE}/hard`}
        icon="📕"
        label="难词本"
        description={
          hardCount > 0
            ? `待巩固 ${hardCount} 个词 · 答对自动移出`
            : '答错收录 · 集中复习'
        }
        gradient="linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fecaca 100%)"
        border="rgba(239,68,68,.35)"
        shadow="0 4px 20px rgba(239,68,68,.12)"
        text="#991b1b"
        badge={hardCount > 0 ? String(hardCount) : undefined}
      />
      <EnglishQuickLinkCard
        href="/admin/words"
        icon="🗂️"
        label="词库管理"
        description="增删改查 · 批量导入 · AI 填充"
        gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)"
        border="rgba(245,158,11,.35)"
        shadow="0 4px 20px rgba(245,158,11,.12)"
        text="#92400e"
        badge={vocab.length > 0 ? String(vocab.length) : undefined}
      />
    </div>
  )
}
