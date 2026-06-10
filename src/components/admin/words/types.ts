// 词库结构树：既用于「草稿词库」的 localStorage 持久化，也用于「vocab + 草稿」合并后的级联选项。
export interface StageUnit {
  unit: string
  lessons: string[]
}

export interface StageTree {
  stage: string
  units: StageUnit[]
}

/** 关键词高亮的固定调色板，对应 globals.css 里的 .kw-* 语义色 */
export const KW_COLORS: { cls: string; label: string; hex: string }[] = [
  { cls: 'kw-red', label: '红', hex: '#ff6b8a' },
  { cls: 'kw-gold', label: '金', hex: '#ffd166' },
  { cls: 'kw-blue', label: '蓝', hex: '#74c2f7' },
]

export const DEFAULT_KW_COLOR = 'kw-red'

/** 不可变地把 stage / unit / lesson 合并进结构树（用于草稿增量） */
export function withDraftEntry(
  list: StageTree[],
  stage: string,
  unit?: string,
  lesson?: string,
): StageTree[] {
  const next = list.map((s) => ({
    stage: s.stage,
    units: s.units.map((u) => ({ unit: u.unit, lessons: [...u.lessons] })),
  }))
  let st = next.find((s) => s.stage === stage)
  if (!st) {
    st = { stage, units: [] }
    next.push(st)
  }
  if (unit) {
    let un = st.units.find((u) => u.unit === unit)
    if (!un) {
      un = { unit, lessons: [] }
      st.units.push(un)
    }
    if (lesson && !un.lessons.includes(lesson)) un.lessons.push(lesson)
  }
  return next
}
