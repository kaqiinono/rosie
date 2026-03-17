import { SYLLABLE_MAP } from './english-data'

export type PhonicsClass =
  | 'ph-vowel' | 'ph-long' | 'ph-digraph' | 'ph-cluster'
  | 'ph-blend' | 'ph-r' | 'ph-magic' | 'ph-suffix' | 'ph-silent' | 'ph-plain'

interface PhRule {
  p: string
  c: PhonicsClass
}

const PH_RULES_RAW: PhRule[] = [
  { p: 'ar', c: 'ph-r' }, { p: 'er', c: 'ph-r' }, { p: 'ir', c: 'ph-r' }, { p: 'or', c: 'ph-r' }, { p: 'ur', c: 'ph-r' },
  { p: 'oo', c: 'ph-digraph' }, { p: 'ee', c: 'ph-digraph' }, { p: 'ea', c: 'ph-digraph' }, { p: 'ai', c: 'ph-digraph' },
  { p: 'ay', c: 'ph-digraph' }, { p: 'oa', c: 'ph-digraph' }, { p: 'oe', c: 'ph-digraph' }, { p: 'ou', c: 'ph-digraph' },
  { p: 'ow', c: 'ph-digraph' }, { p: 'oi', c: 'ph-digraph' }, { p: 'oy', c: 'ph-digraph' }, { p: 'au', c: 'ph-digraph' },
  { p: 'aw', c: 'ph-digraph' }, { p: 'ie', c: 'ph-digraph' }, { p: 'ue', c: 'ph-digraph' }, { p: 'ui', c: 'ph-digraph' },
  { p: 'ey', c: 'ph-digraph' }, { p: 'ew', c: 'ph-digraph' },
  { p: 'tch', c: 'ph-cluster' }, { p: 'dge', c: 'ph-cluster' }, { p: 'ch', c: 'ph-cluster' }, { p: 'sh', c: 'ph-cluster' },
  { p: 'th', c: 'ph-cluster' }, { p: 'wh', c: 'ph-cluster' }, { p: 'ph', c: 'ph-cluster' }, { p: 'ck', c: 'ph-cluster' },
  { p: 'ng', c: 'ph-cluster' }, { p: 'nk', c: 'ph-cluster' }, { p: 'qu', c: 'ph-cluster' }, { p: 'gh', c: 'ph-cluster' },
  { p: 'str', c: 'ph-blend' }, { p: 'spl', c: 'ph-blend' }, { p: 'spr', c: 'ph-blend' }, { p: 'scr', c: 'ph-blend' },
  { p: 'shr', c: 'ph-blend' }, { p: 'thr', c: 'ph-blend' },
  { p: 'br', c: 'ph-blend' }, { p: 'cr', c: 'ph-blend' }, { p: 'dr', c: 'ph-blend' }, { p: 'fr', c: 'ph-blend' },
  { p: 'gr', c: 'ph-blend' }, { p: 'pr', c: 'ph-blend' }, { p: 'tr', c: 'ph-blend' }, { p: 'bl', c: 'ph-blend' },
  { p: 'cl', c: 'ph-blend' }, { p: 'fl', c: 'ph-blend' }, { p: 'gl', c: 'ph-blend' }, { p: 'pl', c: 'ph-blend' },
  { p: 'sl', c: 'ph-blend' }, { p: 'sc', c: 'ph-blend' }, { p: 'sk', c: 'ph-blend' }, { p: 'sm', c: 'ph-blend' },
  { p: 'sn', c: 'ph-blend' }, { p: 'sp', c: 'ph-blend' }, { p: 'st', c: 'ph-blend' }, { p: 'sw', c: 'ph-blend' },
  { p: 'tw', c: 'ph-blend' },
  { p: 'tion', c: 'ph-suffix' }, { p: 'sion', c: 'ph-suffix' }, { p: 'ture', c: 'ph-suffix' }, { p: 'ous', c: 'ph-suffix' },
  { p: 'ful', c: 'ph-suffix' }, { p: 'less', c: 'ph-suffix' }, { p: 'ness', c: 'ph-suffix' }, { p: 'ment', c: 'ph-suffix' },
  { p: 'ling', c: 'ph-suffix' }, { p: 'ing', c: 'ph-suffix' }, { p: 'ible', c: 'ph-suffix' }, { p: 'able', c: 'ph-suffix' },
  { p: 'ical', c: 'ph-suffix' }, { p: 'ity', c: 'ph-suffix' }, { p: 'ify', c: 'ph-suffix' }, { p: 'ise', c: 'ph-suffix' },
  { p: 'ize', c: 'ph-suffix' }, { p: 'ance', c: 'ph-suffix' }, { p: 'ence', c: 'ph-suffix' },
]
const PH_RULES = PH_RULES_RAW.sort((a, b) => b.p.length - a.p.length)

function hasMagicE(w: string): boolean {
  return /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]+e$/i.test(w)
}

function magicEPos(w: string): { vi: number; ei: number } | null {
  const m = w.match(/([bcdfghjklmnpqrstvwxyz])([aeiou])([bcdfghjklmnpqrstvwxyz]+)(e)$/i)
  if (!m) return null
  return { vi: w.length - m[0].length + m[1].length, ei: w.length - 1 }
}

interface CharInfo {
  ch: string
  c: PhonicsClass
}

function tokenize(word: string): CharInfo[] {
  const lo = word.toLowerCase()
  const len = lo.length
  const cls: (PhonicsClass | null)[] = new Array(len).fill(null)

  for (const r of PH_RULES) {
    let i = 0
    while (i <= len - r.p.length) {
      if (lo.slice(i, i + r.p.length) === r.p) {
        let free = true
        for (let j = i; j < i + r.p.length; j++) {
          if (cls[j] !== null) { free = false; break }
        }
        if (free) {
          for (let j = i; j < i + r.p.length; j++) cls[j] = r.c
        }
        i += r.p.length
      } else {
        i++
      }
    }
  }

  for (let i = 0; i < len; i++) {
    if (cls[i] === null) {
      cls[i] = /[aeiou]/i.test(lo[i]) ? 'ph-vowel' : 'ph-plain'
    }
  }

  const chars: CharInfo[] = []
  for (let i = 0; i < len; i++) {
    chars.push({ ch: word[i], c: cls[i]! })
  }
  return chars
}

export interface PhonicsSegment {
  text: string
  cls: PhonicsClass
  isMagicE?: boolean
  magicArcStart?: boolean
  magicArcEnd?: boolean
  syllableDotBefore?: boolean
}

export function colorizeWord(word: string): PhonicsSegment[] {
  const chars = tokenize(word)
  const me = hasMagicE(word) ? magicEPos(word) : null
  const sylls = SYLLABLE_MAP[word.toLowerCase()]

  if (me) {
    chars[me.vi].c = 'ph-magic'
    chars[me.ei].c = 'ph-magic'
  }

  const bounds = new Set<number>()
  if (sylls && sylls.length > 1) {
    let p = 0
    for (let i = 0; i < sylls.length - 1; i++) {
      p += sylls[i].length
      bounds.add(p)
    }
  }

  const segments: PhonicsSegment[] = []
  for (let i = 0; i < chars.length; i++) {
    segments.push({
      text: chars[i].ch,
      cls: chars[i].c,
      syllableDotBefore: bounds.has(i),
      magicArcStart: me ? i === me.vi : false,
      magicArcEnd: me ? i === me.ei : false,
    })
  }
  return segments
}

export function buildPhonicsSegments(text: string): PhonicsSegment[][] {
  const words = text.trim().split(/\s+/)
  if (words.length === 1) {
    const clean = text.replace(/[^a-zA-Z]/g, '')
    if (clean.length >= 2) return [colorizeWord(clean)]
    return [[{ text, cls: 'ph-plain' }]]
  }
  return words.map(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '')
    if (clean.length >= 2) return colorizeWord(clean)
    return [{ text: w, cls: 'ph-plain' as PhonicsClass }]
  })
}

export function getWordSizeClass(word: string): string {
  const parts = word.trim().split(/\s+/)
  const len = word.length
  if (parts.length > 3 || len > 20) return 'is-long'
  if (parts.length > 1 || len > 10) return 'is-phrase'
  return ''
}

export const PHONICS_LEGEND = [
  { cls: 'ph-vowel', color: '#ff6b6b', label: '短元音' },
  { cls: 'ph-long', color: '#f1948a', label: '长元音' },
  { cls: 'ph-digraph', color: '#45b7d1', label: '元音组合' },
  { cls: 'ph-cluster', color: '#4ecdc4', label: '辅音组合' },
  { cls: 'ph-blend', color: '#f0b27a', label: '辅音丛' },
  { cls: 'ph-r', color: '#bb8fce', label: 'R控元音' },
  { cls: 'ph-magic', color: '#f7dc6f', label: '魔力E' },
  { cls: 'ph-suffix', color: '#82e0aa', label: '特殊后缀' },
  { cls: 'ph-silent', color: '#888', label: '静音字母' },
] as const
