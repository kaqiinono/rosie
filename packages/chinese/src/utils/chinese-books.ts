import type { ChineseUnitEntry } from './g1b/types'
import { UNITS as G1B_UNITS } from './g1b'
import { UNITS as G2A_UNITS } from './g2a'
import { UNITS as G2B_UNITS } from './g2b'
import g1bStats from './g1b/stats.json'
import g2aStats from './g2a/stats.json'
import g2bStats from './g2b/stats.json'
import { parseBookSlug } from './chinese-helpers'
import { formatGradeSemester } from './chinese-roadmap'

export type ChineseBookSlug = 'g1b' | 'g2a' | 'g2b'

export interface ChineseBookMeta {
  slug: ChineseBookSlug
  label: string
  grade: number
  semester: '上' | '下'
  units: ChineseUnitEntry[]
  recognizeTotal: number
  writeTotal: number
  isOpen: boolean
}

const BOOK_REGISTRY: Record<ChineseBookSlug, ChineseBookMeta> = {
  g1b: {
    slug: 'g1b',
    label: formatGradeSemester(1, '下'),
    grade: 1,
    semester: '下',
    units: G1B_UNITS,
    recognizeTotal: g1bStats.targetRecognizeTable,
    writeTotal: g1bStats.targetWriteTable,
    isOpen: true,
  },
  g2a: {
    slug: 'g2a',
    label: formatGradeSemester(2, '上'),
    grade: 2,
    semester: '上',
    units: G2A_UNITS,
    recognizeTotal: g2aStats.recognizeListUnique,
    writeTotal: g2aStats.writeListUnique,
    isOpen: true,
  },
  g2b: {
    slug: 'g2b',
    label: formatGradeSemester(2, '下'),
    grade: 2,
    semester: '下',
    units: G2B_UNITS,
    recognizeTotal: g2bStats.recognizeListUnique,
    writeTotal: g2bStats.writeListUnique,
    isOpen: true,
  },
}

export const CHINESE_BOOKS = Object.values(BOOK_REGISTRY)

export function getChineseBook(slug: string): ChineseBookMeta | null {
  if (slug in BOOK_REGISTRY) return BOOK_REGISTRY[slug as ChineseBookSlug]
  const parsed = parseBookSlug(slug)
  if (!parsed) return null
  const key = `g${parsed.grade}${parsed.semester === '上' ? 'a' : 'b'}` as ChineseBookSlug
  return BOOK_REGISTRY[key] ?? null
}

export function isChineseBookSlug(slug: string): slug is ChineseBookSlug {
  return slug in BOOK_REGISTRY
}
