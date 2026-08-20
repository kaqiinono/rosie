import { supabase } from '@rosie/core'
import { patchGrammarUnitCache } from './hooks/useGrammarUnit'
import type { GrammarLesson, GrammarUnitDetail } from './types'

/** 用管理员编辑器整体保存讲解 JSON，保留单元其余字段不变。 */
export async function saveGrammarLesson(
  unit: GrammarUnitDetail,
  lesson: GrammarLesson,
): Promise<GrammarUnitDetail> {
  const { data, error } = await supabase
    .from('grammar_units')
    .update({ lesson })
    .eq('book', unit.book)
    .eq('unit_number', unit.unitNumber)
    .select('book, unit_number')
    .maybeSingle()

  if (error) throw new Error(`保存讲解失败：${error.message}`)
  if (!data) throw new Error('保存未命中目标单元，请确认管理员权限后重试')

  const updated: GrammarUnitDetail = { ...unit, lesson }
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}
