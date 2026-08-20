import { supabase } from '@rosie/core'
import { patchGrammarUnitCache } from './hooks/useGrammarUnit'
import type { GrammarTableBlock, GrammarUnitDetail } from './types'

/** 管理员保存单个语法表格，仅替换目标 block，保留 Section 的其他内容与插图。 */
export async function saveGrammarTable(
  unit: GrammarUnitDetail,
  sectionIdx: number,
  blockIdx: number,
  table: GrammarTableBlock,
): Promise<GrammarUnitDetail> {
  const section = unit.lesson.sections[sectionIdx]
  if (!section || section.blocks[blockIdx]?.type !== 'grammar_table') {
    throw new Error('目标表格不存在，请刷新页面后重试')
  }

  const lesson = {
    ...unit.lesson,
    sections: unit.lesson.sections.map((item, index) =>
      index === sectionIdx
        ? {
            ...item,
            blocks: item.blocks.map((block, blockIndex) =>
              blockIndex === blockIdx ? table : block,
            ),
          }
        : item,
    ),
  }
  const { data, error } = await supabase
    .from('grammar_units')
    .update({ lesson })
    .eq('book', unit.book)
    .eq('unit_number', unit.unitNumber)
    .select('book, unit_number')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('保存未命中目标单元，请确认管理员权限后重试')

  const updated: GrammarUnitDetail = { ...unit, lesson }
  patchGrammarUnitCache(unit.book, unit.unitNumber, updated)
  return updated
}
