import { supabase } from '@rosie/core'
import { patchGrammarUnitCache } from './hooks/useGrammarUnit'
import type { GrammarExerciseGroup, GrammarUnitDetail } from './types'

/** 管理员覆盖当前单元的完整练习结构，并同步模块缓存。 */
export async function saveGrammarExercises(
  unit: GrammarUnitDetail,
  exercises: GrammarExerciseGroup[],
): Promise<GrammarUnitDetail> {
  const { data, error } = await supabase
    .from('grammar_units')
    .update({ exercises })
    .eq('book', unit.book)
    .eq('unit_number', unit.unitNumber)
    .select('book, unit_number')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('保存未命中目标单元，请确认管理员权限后重试')

  const updated: GrammarUnitDetail = { ...unit, exercises }
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}
