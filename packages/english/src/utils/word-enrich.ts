// 单词自动填充：优先走服务端 Claude 路由（/api/word-enrich），
// 失败时兜底到免费词典 dictionaryapi.dev。返回结果会标注 source，
// 以便 UI 明确告知用户信息来自哪个数据源。

export type EnrichSource = 'claude' | 'dictionary'

export interface EnrichResult {
  source: EnrichSource
  /** Claude 路由返回的模型 id（dictionary 兜底时为空） */
  model?: string
  ipa: string
  explanation: string
  chineseDef: string
  example: string
  /** 兜底/异常时的提示信息，供 UI 展示 */
  note?: string
}

interface DictPhonetic {
  text?: string
}
interface DictDefinition {
  definition?: string
  example?: string
}
interface DictMeaning {
  definitions?: DictDefinition[]
}
interface DictEntry {
  phonetic?: string
  phonetics?: DictPhonetic[]
  meanings?: DictMeaning[]
}

async function enrichFromDictionary(word: string): Promise<EnrichResult> {
  const result: EnrichResult = {
    source: 'dictionary',
    ipa: '',
    explanation: '',
    chineseDef: '',
    example: '',
    note: '免费词典无中文释义，请手动补充中文。',
  }
  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
    )
    if (!r.ok) {
      result.note = '免费词典未收录该词（短语常查不到），请手动填写。'
      return result
    }
    const data = (await r.json()) as DictEntry[]
    const first = data?.[0]
    if (!first) return result
    result.ipa = first.phonetic || first.phonetics?.find((p) => p.text)?.text || ''
    const def = first.meanings?.[0]?.definitions?.[0]
    result.explanation = def?.definition || ''
    result.example = def?.example || ''
  } catch {
    result.note = '免费词典请求失败，请手动填写。'
  }
  return result
}

export async function enrichWord(word: string, stage?: string): Promise<EnrichResult> {
  const trimmed = word.trim()
  if (!trimmed) {
    return { source: 'dictionary', ipa: '', explanation: '', chineseDef: '', example: '', note: '请先输入单词。' }
  }

  // 1) 优先 Claude 服务端路由
  try {
    const r = await fetch('/api/word-enrich', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: trimmed, stage }),
    })
    if (r.ok) {
      const d = (await r.json()) as Partial<EnrichResult>
      return {
        source: 'claude',
        model: d.model,
        ipa: d.ipa || '',
        explanation: d.explanation || '',
        chineseDef: d.chineseDef || '',
        example: d.example || '',
      }
    }
  } catch {
    /* 落到词典兜底 */
  }

  // 2) 兜底免费词典
  const fallback = await enrichFromDictionary(trimmed)
  fallback.note = `Claude 暂不可用，已改用免费词典。${fallback.note ?? ''}`.trim()
  return fallback
}
