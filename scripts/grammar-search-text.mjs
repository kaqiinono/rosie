/**
 * 语法单元搜索文本生成（首页高级检索索引）。
 *
 * 口径与 scripts/ai-sync-db.mjs 的 grammarBlockLines 一致：只展平讲解块，
 * 练习题与答案不参与（防答案泄露 + 降噪）。
 * 使用方：scripts/extract-grammar-unit.mjs（upsert 时生成）、
 * scripts/tmp/backfill-grammar-search-text.mjs（存量回填）。
 */

function grammarBlockLines(block) {
  if (!block || typeof block !== 'object') return []
  switch (block.type) {
    case 'rule_text':
    case 'tip':
    case 'image_description':
    case 'unsupported':
      return block.text ? [block.text] : []
    case 'spelling_rule': {
      const lines = block.text ? [block.text] : []
      if (Array.isArray(block.examples)) {
        const pairs = block.examples
          .map((e) => `${e.base} → ${e.form}`)
          .filter(Boolean)
          .join('; ')
        if (pairs) lines.push(pairs)
      }
      return lines
    }
    case 'example_set': {
      const lines = block.context ? [block.context] : []
      for (const item of block.items ?? []) {
        const parts = [item.en, item.zh, item.note].filter(Boolean)
        if (parts.length) lines.push(parts.join(' '))
      }
      return lines
    }
    case 'examples':
      return (block.items ?? []).map((item) =>
        [item.en, item.zh, item.note].filter(Boolean).join(' '),
      )
    case 'contraction_note':
      return (block.items ?? []).map((item) => `${item.full} → ${item.short}`)
    case 'grammar_table': {
      const lines = block.title ? [`表: ${block.title}`] : []
      const headers = (block.headers ?? []).filter(Boolean)
      if (headers.length) lines.push(headers.join(' | '))
      for (const row of block.rows ?? []) {
        const cells = (row ?? []).map((c) => String(c ?? ''))
        if (cells.some((c) => c.trim())) lines.push(cells.join(' | '))
      }
      return lines
    }
    default:
      return typeof block.text === 'string' && block.text ? [block.text] : []
  }
}

function grammarLessonText(lesson) {
  const lines = []
  for (const section of lesson?.sections ?? []) {
    if (section.title) lines.push(`【${section.title}】`)
    for (const block of section.blocks ?? []) lines.push(...grammarBlockLines(block))
  }
  return lines.filter(Boolean).join('\n')
}

/**
 * 由 DB 行（title/title_zh/category/category_zh/lesson）生成 search_text。
 * 头部是元数据前缀（前端用它判定「标题/分类命中」排序），后接讲解展平文本。
 */
export function buildGrammarSearchText(row) {
  const prefix = [row.title, row.title_zh, row.category, row.category_zh].filter(
    (v) => typeof v === 'string' && v.trim(),
  )
  const body = grammarLessonText(row.lesson)
  return [...prefix, body].filter(Boolean).join('\n')
}
