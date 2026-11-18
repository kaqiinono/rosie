import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentBlock } from '../../types'

interface WordRow {
  id: string
  word: string
  ipa: string | null
  shared_chinese_def: string | null
  shared_explanation: string | null
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
  const { data: headwordId, error: lookupError } = await supabase.rpc('find_vocabulary_headword', { p_word: word })
  if (lookupError) throw lookupError
  if (!headwordId) return { block: null, sourceRef: null }
  const { data, error } = await supabase
    .from('vocabulary_search')
    .select(
      'id, word, ipa, shared_chinese_def, shared_explanation, example, unit, lesson, stage, phonics, syllables, keywords, vocab_type, image_path',
    )
    .eq('headword_id', headwordId)
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
    chineseDef: row.shared_chinese_def ?? row.shared_explanation ?? '暂无释义',
    example: row.example ?? undefined,
    stage: row.stage ?? undefined,
    unit: row.unit ?? undefined,
    lesson: row.lesson ?? undefined,
    explanation: row.shared_explanation ?? undefined,
    phonics: row.phonics ?? undefined,
    syllables: row.syllables ?? undefined,
    keywords: row.keywords ?? undefined,
    vocabType: row.vocab_type ?? undefined,
    imagePath: row.image_path ?? undefined,
  }

  return { block, sourceRef }
}
