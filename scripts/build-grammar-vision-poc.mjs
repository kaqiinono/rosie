#!/usr/bin/env node

/**
 * POC: Use Claude Vision to extract structured grammar data from textbook page images.
 *
 * Usage:
 *   node scripts/build-grammar-vision-poc.mjs
 *
 * Reads the already-rendered PNGs for Unit 1 (pages 21-22) from output/grammar-pilot/,
 * sends them to Claude Haiku 4.5 Vision, and writes structured JSON output.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────────────
// Read env from apps/web/.env.local (simple key=value parser, no dotenv dep)
function loadEnv() {
  const envPath = resolve(root, 'apps/web/.env.local')
  const text = readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = loadEnv()
const API_KEY = env.AI_EMBED_API_KEY
const BASE_URL = env.AI_EMBED_BASE_URL
// 百炼视觉模型：qwen-vl-max 效果最好，qwen-vl-plus 更便宜
const VISION_MODEL = process.argv[2] || 'qwen-vl-max'

if (!API_KEY) {
  console.error('Error: AI_EMBED_API_KEY not found in apps/web/.env.local')
  process.exit(1)
}
if (!BASE_URL) {
  console.error('Error: AI_EMBED_BASE_URL not found in apps/web/.env.local')
  process.exit(1)
}

// ── Extraction Prompt ─────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `你是一位英语语法教材内容的**逐字转录**专家。你的任务是**忠实地还原**图片中的全部教学内容，不要总结、不要改写、不要遗漏。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）。

{
  "unitNumber": <数字>,
  "title": "<英文标题，逐字抄写>",
  "titleZh": "<中文标题，逐字抄写>",
  "pageType": "lesson | exercise",
  "category": "<英文分类 id，根据语法主题推断：present_tense / present_continuous / past_tense / future / modals / articles / prepositions / conjunctions / conditionals / passive / reported_speech / relative_clauses / quantifiers / comparatives / imperatives / gerunds_infinitives 等>",
  "categoryZh": "<中文分类名>",
  "difficulty": <1-5 的整数，根据内容难度推断>,

  "sections": [
    {
      "label": "A | B | C | ...  或 null（无标签时）",
      "title": "<本节标题或描述，逐字抄写>",
      "blocks": [
        // 按页面从上到下的顺序，每个独立内容块为一个 block
        // block 类型如下（用 type 字段区分）：

        // 1) 情境对话/例句列表（通常配有人物插图）
        { "type": "example_set", "context": "<场景描述，如'Lisa 自我介绍'>", "items": [
          { "en": "<逐字英文>", "zh": "<逐字中文翻译>", "bold": ["<加粗的词>"] }
        ]},

        // 2) 语法表格（动词变位表等）
        { "type": "grammar_table", "title": "<表格标题，如'肯定式'/'否定式'>", "headers": ["<列标题>"], "rows": [["<单元格内容>"]] },

        // 3) 语法规则说明（中文段落）
        { "type": "rule_text", "text": "<逐字抄写中文语法说明，保留原文用词>" },

        // 4) 散列例句（带方块符号的例句列表）
        { "type": "examples", "items": [
          { "en": "<逐字英文>", "zh": "<逐字中文>", "note": "<括号内注释或 null>" }
        ]},

        // 5) 拼写/特殊规则
        { "type": "spelling_rule", "text": "<逐字抄写>", "examples": [
          { "base": "come", "form": "coming" }
        ]},

        // 6) 缩略形式说明
        { "type": "contraction_note", "items": [
          { "full": "that is", "short": "that's" }
        ]},

        // 7) 注意事项/提示
        { "type": "tip", "text": "<逐字抄写>" }
      ]
    }
  ],

  "crossReferences": [
    { "text": "<逐字抄写，如 'am/is/are (疑问句) → Unit 2'>", "targetUnit": <数字或null> }
  ],

  "exercises": [
    {
      "section": "<分组编号，如 '1.1', '1.2'>",
      "instruction": "<题目指令，逐字抄写中文>",
      "items": [
        {
          "number": <组内序号>,
          "type": "choice | fill_blank | error_correction | transformation | sentence_completion | matching | short_answer",
          "prompt": "<题干文本，逐字抄写，填空用 ______ 表示>",
          "options": ["A. ...", "B. ..."] | null,
          "answer": "<正确答案>",
          "answerNote": "<可选补充说明或解析>"
        }
      ]
    }
  ]
}

**严格规则**（必须遵守）：
1. **逐字抄写**，不要改写、总结或补充。原文写什么就提取什么
2. 英文例句中的**加粗词**记录到 bold 数组（如 ["is", "am"]）
3. 中文语法说明**原文照抄**，不要用你自己的话改写
4. 练习题的指令文字（如"填入 am, is 或 are"）**原文照抄**
5. 练习题填空处统一用 6 个下划线 ______ 表示
6. **不要遗漏任何内容**：包括脚注、交叉引用、附录引用
7. 忽略纯装饰性插图（人物漫画、背景画），但要描述有教学内容的情境插图（如"旅馆前台场景"）
8. sections 数组仅在 lesson 页使用；exercise 页的 sections 为空数组
9. exercises 数组仅在 exercise 页使用；lesson 页的 exercises 为空数组
10. 如果图片中同时有讲解和练习（某些单元），两者都要提取`

// ── API Call ──────────────────────────────────────────────────────────────────
async function extractFromImage(imagePath, pageNumber) {
  const imageBuffer = readFileSync(imagePath)
  const base64 = imageBuffer.toString('base64')
  const mediaType = 'image/png'

  console.log(`[${pageNumber}] Sending to ${VISION_MODEL} (${Math.round(imageBuffer.length / 1024)}KB)...`)

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API ${response.status}: ${errorText}`)
  }

  const result = await response.json()
  const raw = (result.choices?.[0]?.message?.content ?? '').trim()
  if (!raw) throw new Error('Empty response from model')

  // Parse JSON (strip possible markdown code fences)
  let cleaned = raw
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const data = JSON.parse(cleaned)

  const usage = result.usage ?? {}
  console.log(`[${pageNumber}] ✓ Unit ${data.unitNumber}: "${data.title}"`)
  console.log(`         Rules: ${data.rules?.length ?? 0}, Examples: ${data.examples?.length ?? 0}, Exercises: ${data.exercises?.length ?? 0}`)
  console.log(`         Tokens: ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out`)

  return data
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const pilotDir = resolve(root, 'output/grammar-pilot/units-001-010')
  const outputDir = resolve(root, 'output/grammar-vision-poc')
  mkdirSync(outputDir, { recursive: true })

  // Unit 1 = page 21 (讲解) + page 22 (练习)
  const pages = [
    { path: resolve(pilotDir, 'page-0021.png'), number: 21, label: 'Unit 1 讲解页' },
    { path: resolve(pilotDir, 'page-0022.png'), number: 22, label: 'Unit 1 练习页' },
  ]

  // Verify files exist
  for (const p of pages) {
    if (!existsSync(p.path)) {
      console.error(`Missing: ${p.path}`)
      process.exit(1)
    }
  }

  console.log('═'.repeat(60))
  console.log('Grammar Vision POC — 百炼 ' + VISION_MODEL)
  console.log('═'.repeat(60))
  console.log()

  const results = []
  for (const page of pages) {
    console.log(`── ${page.label} (PDF page ${page.number}) ──`)
    try {
      const data = await extractFromImage(page.path, page.number)
      results.push({ page: page.number, label: page.label, data })

      // Write individual result
      writeFileSync(
        resolve(outputDir, `page-${String(page.number).padStart(4, '0')}.json`),
        JSON.stringify(data, null, 2) + '\n',
      )
    } catch (err) {
      console.error(`[${page.number}] Error: ${err.message}`)
      results.push({ page: page.number, label: page.label, error: err.message })
    }
    console.log()
  }

  // Write combined result
  writeFileSync(
    resolve(outputDir, 'combined.json'),
    JSON.stringify(results, null, 2) + '\n',
  )

  console.log('═'.repeat(60))
  console.log(`Done! Results written to: ${outputDir}/`)
  console.log('═'.repeat(60))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
