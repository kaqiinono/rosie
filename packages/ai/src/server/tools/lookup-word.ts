import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentBlock } from '../../types'

interface WordRow {
  id: string
  word: string
  ipa: string | null
  chinese_def: string | null
  explanation: string | null
  example: string | null
  unit: string | null
  lesson: string | null
  stage: string | null
  phonics: string | null
  syllables: string[] | null
  keywords: [string, string][] | null
  vocab_type: 'Target' | 'Context' | 'Extension' | null
  image_path: string | null
}

export async function lookupWord(
  supabase: SupabaseClient,
  word: string,
): Promise<{ block: AgentBlock | null; sourceRef: string | null }> {
  const { data, error } = await supabase
    .from('word_entries')
    .select(
      'id, word, ipa, chinese_def, explanation, example, unit, lesson, stage, phonics, syllables, keywords, vocab_type, image_path',
    )
    .ilike('word', word)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return { block: null, sourceRef: null }

  const row = data as WordRow
  const sourceRef = `word_entries:${row.id}`
  const block: AgentBlock = {
    type: 'word_card',
    sourceRef,
    word: row.word,
    ipa: row.ipa ?? undefined,
    chineseDef: row.chinese_def ?? row.explanation ?? '暂无释义',
    example: row.example ?? undefined,
    stage: row.stage ?? undefined,
    unit: row.unit ?? undefined,
    lesson: row.lesson ?? undefined,
    explanation: row.explanation ?? undefined,
    phonics: row.phonics ?? undefined,
    syllables: row.syllables ?? undefined,
    keywords: row.keywords ?? undefined,
    vocabType: row.vocab_type ?? undefined,
    imagePath: row.image_path ?? undefined,
  }

  return { block, sourceRef }
}
