/**
 * 插图的写入/删除（admin 专用）。练习组级 figure + 讲解 Section 级 figures。
 * 流程：canvas 裁出的 PNG blob → Storage upload → jsonb 字段（exercises / lesson）
 * → 模块缓存 patch。失败补偿：DB 写失败时回滚删除已上传文件。
 */
import { supabase } from '@rosie/core'
import type { GrammarFigure, GrammarUnitDetail } from './types'
import { GRAMMAR_PAGES_BUCKET } from './types'
import { patchGrammarUnitCache } from './hooks/useGrammarUnit'

function figurePath(unit: GrammarUnitDetail): string {
  const nn = String(unit.unitNumber).padStart(3, '0')
  return `${unit.book}/unit${nn}/figures/fig-${Date.now()}.png`
}

/** DB exercises jsonb 中第 groupIdx 组的 figure 置为 next（undefined = 清除），返回新数组 */
function withGroupFigure(
  unit: GrammarUnitDetail,
  groupIdx: number,
  next: { path: string; page: number } | undefined,
): unknown[] {
  return unit.exercises.map((g, i) => {
    if (i !== groupIdx) return g
    const rest: Record<string, unknown> = { section: g.section, instruction: g.instruction, items: g.items }
    if (typeof g.bookPage === 'number') rest.bookPage = g.bookPage
    if (next) rest.figure = next
    return rest
  })
}

async function updateExercises(unit: GrammarUnitDetail, exercises: unknown[]): Promise<void> {
  const { error } = await supabase
    .from('grammar_units')
    .update({ exercises })
    .eq('book', unit.book)
    .eq('unit_number', unit.unitNumber)
  if (error) throw new Error(error.message)
}

async function updateLesson(unit: GrammarUnitDetail, lesson: unknown): Promise<void> {
  const { error } = await supabase
    .from('grammar_units')
    .update({ lesson })
    .eq('book', unit.book)
    .eq('unit_number', unit.unitNumber)
  if (error) throw new Error(error.message)
}

function removeFigureFile(path: string, label: string): void {
  void supabase.storage
    .from(GRAMMAR_PAGES_BUCKET)
    .remove([path])
    .then(({ error }) => {
      if (error) console.warn(`[grammar-figure] ${label}:`, error.message)
    })
}

/** 裁切插图插入/替换某组。替换时 DB 成功后删除旧文件（失败仅告警） */
export async function saveGroupFigure(
  unit: GrammarUnitDetail,
  groupIdx: number,
  blob: Blob,
  page: number,
): Promise<GrammarUnitDetail> {
  const path = figurePath(unit)
  const { error: uploadError } = await supabase.storage
    .from(GRAMMAR_PAGES_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const exercises = withGroupFigure(unit, groupIdx, { path, page })
  try {
    await updateExercises(unit, exercises)
  } catch (err) {
    // 失败补偿：不留孤儿文件
    const { error: removeError } = await supabase.storage.from(GRAMMAR_PAGES_BUCKET).remove([path])
    if (removeError) console.warn('[grammar-figure] rollback remove failed:', removeError.message)
    throw err
  }

  const oldFigure = unit.exercises[groupIdx]?.figure
  if (oldFigure && oldFigure.path !== path) removeFigureFile(oldFigure.path, 'old group figure remove failed')

  const updated: GrammarUnitDetail = {
    ...unit,
    exercises: unit.exercises.map((g, i) => (i === groupIdx ? { ...g, figure: { path, page } } : g)),
  }
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}

/** 删除某组插图：先清 DB 字段，再删 Storage 文件（失败仅告警） */
export async function removeGroupFigure(unit: GrammarUnitDetail, groupIdx: number): Promise<GrammarUnitDetail> {
  const oldFigure = unit.exercises[groupIdx]?.figure
  await updateExercises(unit, withGroupFigure(unit, groupIdx, undefined))
  if (oldFigure) removeFigureFile(oldFigure.path, 'group figure remove failed')
  const updated: GrammarUnitDetail = {
    ...unit,
    exercises: unit.exercises.map((g, i) => (i === groupIdx ? { ...g, figure: undefined } : g)),
  }
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}

// ── 讲解 Section 级 figures ──────────────────────────────────────────────────

/** DB lesson jsonb 中第 sectionIdx 个 section 的 figures 置为 next，返回新 lesson 对象 */
function withSectionFigures(unit: GrammarUnitDetail, sectionIdx: number, next: GrammarFigure[]): unknown {
  const sections = unit.lesson.sections.map((s, i) => {
    if (i !== sectionIdx) return s
    const rest: Record<string, unknown> = { label: s.label, title: s.title, blocks: s.blocks }
    if (typeof s.bookPage === 'number') rest.bookPage = s.bookPage
    if (next.length > 0) rest.figures = next
    return rest
  })
  return { sections, crossReferences: unit.lesson.crossReferences }
}

function nextLessonFigures(unit: GrammarUnitDetail, sectionIdx: number, next: GrammarFigure[]): GrammarUnitDetail {
  return {
    ...unit,
    lesson: {
      ...unit.lesson,
      sections: unit.lesson.sections.map((s, i) =>
        i === sectionIdx ? { ...s, figures: next.length > 0 ? next : undefined } : s,
      ),
    },
  }
}

/**
 * 裁切插图插入某 Section。replaceIdx 有值 = 重裁替换该位置（DB 成功后删旧文件），
 * 否则追加到 figures 末尾。
 */
export async function saveSectionFigure(
  unit: GrammarUnitDetail,
  sectionIdx: number,
  blob: Blob,
  page: number,
  replaceIdx?: number,
): Promise<GrammarUnitDetail> {
  const path = figurePath(unit)
  const { error: uploadError } = await supabase.storage
    .from(GRAMMAR_PAGES_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const current = unit.lesson.sections[sectionIdx]?.figures ?? []
  const figure: GrammarFigure = { path, page }
  const next = typeof replaceIdx === 'number' ? current.map((f, i) => (i === replaceIdx ? figure : f)) : [...current, figure]
  try {
    await updateLesson(unit, withSectionFigures(unit, sectionIdx, next))
  } catch (err) {
    // 失败补偿：不留孤儿文件
    const { error: removeError } = await supabase.storage.from(GRAMMAR_PAGES_BUCKET).remove([path])
    if (removeError) console.warn('[grammar-figure] rollback remove failed:', removeError.message)
    throw err
  }

  if (typeof replaceIdx === 'number') {
    const old = current[replaceIdx]
    if (old && old.path !== path) removeFigureFile(old.path, 'old section figure remove failed')
  }

  const updated = nextLessonFigures(unit, sectionIdx, next)
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}

/** 删除某 Section 的第 figureIdx 张插图：先清 DB 字段，再删 Storage 文件（失败仅告警） */
export async function removeSectionFigure(
  unit: GrammarUnitDetail,
  sectionIdx: number,
  figureIdx: number,
): Promise<GrammarUnitDetail> {
  const current = unit.lesson.sections[sectionIdx]?.figures ?? []
  const old = current[figureIdx]
  await updateLesson(unit, withSectionFigures(unit, sectionIdx, current.filter((_, i) => i !== figureIdx)))
  if (old) removeFigureFile(old.path, 'section figure remove failed')
  const updated = nextLessonFigures(unit, sectionIdx, current.filter((_, i) => i !== figureIdx))
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}
