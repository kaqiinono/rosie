import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentBlock } from '../../types'

interface CharRow {
  char_key: string
  char: string
  pinyin: string | null
  phrases: string[] | null
  radical: string | null
  radical_name: string | null
  structure: string | null
  stroke_count: number | null
}

export async function lookupChar(
  supabase: SupabaseClient,
  char: string,
): Promise<{ block: AgentBlock | null; sourceRef: string | null }> {
  const { data, error } = await supabase
    .from('chinese_char_entries')
    .select('char_key, char, pinyin, phrases, radical, radical_name, structure, stroke_count')
    .eq('char', char)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return { block: null, sourceRef: null }

  const row = data as CharRow
  const sourceRef = `chinese_char_entries:${row.char_key}`
  return {
    block: {
      type: 'char_card',
      sourceRef,
      char: row.char,
      pinyin: row.pinyin ?? '',
      phrases: row.phrases ?? [],
      radical: row.radical ?? undefined,
      radicalName: row.radical_name ?? undefined,
      structure: row.structure ?? undefined,
      strokeCount: row.stroke_count ?? undefined,
    },
    sourceRef,
  }
}
