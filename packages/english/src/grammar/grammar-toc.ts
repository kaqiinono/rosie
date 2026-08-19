'use client'

import { useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { GRAMMAR_INDEX } from './grammar-index'
import { useGrammarOverview, type GrammarOverviewEntry } from './hooks/useGrammarOverview'

/**
 * 书目目录章节结构（essential = 《剑桥初级英语语法》原书目录页 v-viii，人工校对）。
 *
 * 章节名沿用原书目录；DB 的 category_zh 粒度更细（如 一般现在时/现在进行时），
 * 目录侧栏按原书章节分组而非 DB category。
 */
export interface GrammarTocSection {
  id: string
  titleZh: string
  /** 单元编号闭区间 [from, to] */
  from: number
  to: number
  /** 书尾延展位分区：卡片不显示编号、头部不显示 Unit 区间 */
  backmatter?: boolean
}

/** 书尾类别 → 图标（首页卡片/目录徽章不显示延展位编号，以类别图标代替） */
export const BACKMATTER_ICONS: Record<string, string> = {
  appendix: '📎',
  supplementary: '✏️',
  study_guide: '🧭',
}

export const GRAMMAR_TOC_SECTIONS: GrammarTocSection[] = [
  { id: 'present', titleZh: '现在时', from: 1, to: 9 },
  { id: 'past', titleZh: '过去时', from: 10, to: 14 },
  { id: 'present-perfect', titleZh: '现在完成时', from: 15, to: 20 },
  { id: 'passive', titleZh: '被动语态', from: 21, to: 22 },
  { id: 'verb-forms', titleZh: '动词形式', from: 23, to: 24 },
  { id: 'future', titleZh: '将来时', from: 25, to: 28 },
  { id: 'modals', titleZh: '情态动词，祈使语气等', from: 29, to: 36 },
  { id: 'there-it', titleZh: 'there 与 it', from: 37, to: 39 },
  { id: 'auxiliaries', titleZh: '助动词', from: 40, to: 43 },
  { id: 'questions', titleZh: '疑问句', from: 44, to: 49 },
  { id: 'reported-speech', titleZh: '间接引语', from: 50, to: 50 },
  { id: 'ing-infinitive', titleZh: '动词 -ing 形式与不定式', from: 51, to: 54 },
  { id: 'verbs', titleZh: 'go, get, do, make 与 have', from: 55, to: 58 },
  { id: 'pronouns', titleZh: '人称代词与所有格', from: 59, to: 64 },
  { id: 'determiners', titleZh: '限定词与代词', from: 65, to: 84 },
  { id: 'adjectives-adverbs', titleZh: '形容词与副词', from: 85, to: 92 },
  { id: 'word-order', titleZh: '词序', from: 93, to: 96 },
  { id: 'conjunctions', titleZh: '连词与从句', from: 97, to: 102 },
  { id: 'prepositions', titleZh: '介词', from: 103, to: 113 },
  { id: 'phrasal-verbs', titleZh: '短语动词', from: 114, to: 115 },
  { id: 'appendix', titleZh: '附录', from: 116, to: 122, backmatter: true },
  { id: 'supplementary', titleZh: '补充练习', from: 123, to: 157, backmatter: true },
  { id: 'study-guide', titleZh: '学习指导', from: 158, to: 169, backmatter: true },
]

/** 目录侧栏条目 = 首页 overview 条目（含解锁状态） */
export type GrammarTocEntry = GrammarOverviewEntry

export interface GrammarTocGroup {
  section: GrammarTocSection
  items: GrammarTocEntry[]
}

/**
 * 按原书目录章节聚合单元，供目录侧栏渲染。
 * 复用 useGrammarOverview 的 session store（与语法首页共享缓存，无额外请求）。
 */
export function useGrammarToc(user: User | null) {
  const { entries, isLoading } = useGrammarOverview(user)

  const groups = useMemo<GrammarTocGroup[]>(() => {
    const byUnit = new Map(entries.map((e) => [e.unitNumber, e]))
    return GRAMMAR_TOC_SECTIONS.map((section) => {
      const items: GrammarTocEntry[] = []
      for (let n = section.from; n <= section.to; n++) {
        const unlocked = byUnit.get(n)
        if (unlocked) {
          items.push(unlocked)
          continue
        }
        // 静态索引存在但单元未入库 → 锁定占位；索引为空时不展示未入库单元
        const idx = GRAMMAR_INDEX.find((e) => e.unitNumber === n)
        if (!idx) continue
        items.push({
          book: idx.book,
          unitNumber: idx.unitNumber,
          title: idx.title,
          titleZh: idx.titleZh,
          category: idx.category,
          categoryZh: idx.categoryZh,
          difficulty: 0,
          bookPages: idx.bookPages,
          locked: true,
        })
      }
      return { section, items }
    }).filter((g) => g.items.length > 0)
  }, [entries])

  return { groups, isLoading }
}
