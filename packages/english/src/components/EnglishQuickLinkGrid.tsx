'use client'

import { useEffect, useState } from 'react'
import { supabase, useAuth } from '@rosie/core'
import { useEnglishWrong } from '../hooks/useEnglishWrong'
import EnglishQuickLinkCard from './EnglishQuickLinkCard'

const BASE = '/english/words'

const STATIC_LINKS = [
  {
    href: `${BASE}/cards`,
    icon: '🃏',
    label: '单词',
    description: '单词卡片 · 翻转记忆 · 沉浸浏览',
    gradient: '#ffe4e6',
    border: 'rgba(233,69,96,.35)',
    shadow: '0 3px 0 rgba(233,69,96,.3)',
    text: '#9f1239',
  },
  {
    href: `${BASE}/practice`,
    icon: '✏️',
    label: '练习',
    description: '选择题 · 拼写 · 多种题型',
    gradient: '#fae8ff',
    border: 'rgba(168,85,247,.35)',
    shadow: '0 3px 0 rgba(168,85,247,.3)',
    text: '#6b21a8',
  },
  {
    href: `${BASE}/daily`,
    icon: '📅',
    label: '计划',
    description: '每日新词 · 多日计划 · 进度追踪',
    gradient: '#dbeafe',
    border: 'rgba(59,130,246,.35)',
    shadow: '0 3px 0 rgba(59,130,246,.3)',
    text: '#1e40af',
  },
  {
    href: `${BASE}/reading`,
    icon: '📖',
    label: '阅读',
    description: '课文朗读 · 生词点读 · 回忆测验',
    gradient: '#d1fae5',
    border: 'rgba(16,185,129,.35)',
    shadow: '0 3px 0 rgba(16,185,129,.3)',
    text: '#047857',
  },
] as const

export default function EnglishQuickLinkGrid() {
  const { user } = useAuth()
  const { wrongKeys } = useEnglishWrong(user)
  // Only a total count is needed for the badge — never pull the full vocab.
  const [wordCount, setWordCount] = useState(0)
  const hardCount = wrongKeys.size

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void supabase
      .from('word_entries')
      .select('word', { count: 'exact', head: true })
      .then(({ count }) => {
        if (!cancelled) setWordCount(count ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="grid grid-cols-2 gap-2 min-[500px]:grid-cols-3 md:grid-cols-4">
      {STATIC_LINKS.map((link) => (
        <EnglishQuickLinkCard key={link.href} {...link} />
      ))}
      <EnglishQuickLinkCard
        href="/english/grammar"
        icon="📗"
        label="语法"
        description="剑桥初级语法 · 116 单元 · 讲解+练习"
        gradient="#dcfce7"
        border="rgba(34,197,94,.35)"
        shadow="0 3px 0 rgba(34,197,94,.3)"
        text="#166534"
      />
      <EnglishQuickLinkCard
        href={`${BASE}/hard`}
        icon="📕"
        label="难词本"
        description={
          hardCount > 0 ? `待巩固 ${hardCount} 个词 · 答对自动移出` : '答错收录 · 集中复习'
        }
        gradient="#fee2e2"
        border="rgba(239,68,68,.35)"
        shadow="0 3px 0 rgba(239,68,68,.3)"
        text="#991b1b"
        badge={hardCount > 0 ? String(hardCount) : undefined}
      />
      <EnglishQuickLinkCard
        href="/english/library"
        icon="🗂️"
        label="词库"
        description="按单词或中英文释义检索词库"
        gradient="#fef3c7"
        border="rgba(245,158,11,.35)"
        shadow="0 3px 0 rgba(245,158,11,.3)"
        text="#92400e"
        badge={wordCount > 0 ? String(wordCount) : undefined}
      />
    </div>
  )
}
