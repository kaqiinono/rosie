#!/usr/bin/env node

/**
 * Grammar unit extraction CLI — 《剑桥初级英语语法》内容提取 + 入库。
 *
 * Pipeline: PDF page → pdftoppm PNG → qwen-vl-max (高保真转录) → 组装 unit.json →
 * service-role upsert 到 grammar_units。幂等：重复执行覆盖同一 unit_number。
 *
 * Usage:
 *   node scripts/extract-grammar-unit.mjs --unit 1              提取 + 入库
 *   node scripts/extract-grammar-unit.mjs --range 1-3           批量（顺序执行）
 *   node scripts/extract-grammar-unit.mjs --unit 1 --no-upload  只落地 JSON
 *   node scripts/extract-grammar-unit.mjs --unit 1 --upload-only 跳过提取直接入库 unit.json
 *   node scripts/extract-grammar-unit.mjs --unit 1 --force      忽略 PNG/JSON 缓存
 *
 * 页码映射：优先 scripts/grammar-page-map.json（Phase 2 `--toc` 产物，格式
 * { "<unit>": { "pdf": [..], "book": [..] } }）；缺失时用临时公式
 * pdfPages = bookPages = [19 + 2N, 20 + 2N] 并打印 WARN。
 *
 * Env（apps/web/.env.local）：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * （入库时必需）；AI_EMBED_API_KEY / AI_EMBED_BASE_URL（提取时必需）。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PDF_PATH = resolve(root, 'docs/english/剑桥初级英语语法.pdf')
const PAGE_MAP_PATH = resolve(root, 'scripts/grammar-page-map.json')
const PAGES_DIR = resolve(root, 'output/grammar-pages')
const UNITS_DIR = resolve(root, 'output/grammar-units')
const VISION_MODEL = process.env.GRAMMAR_VISION_MODEL || 'qwen-vl-max'
const DPI = 300

// ── env / args ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(root, 'apps/web/.env.local')
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, eq).trim()] = value
  }
  return env
}

function usage() {
  console.log(`Usage: node scripts/extract-grammar-unit.mjs [options]

Options:
  --unit <n>        提取单个单元（1-116）
  --range <a-b>     批量提取单元区间
  --no-upload       只落地 JSON，不写 Supabase
  --upload-only     跳过提取，直接读取已有 unit.json 入库
  --force           忽略 PNG / 页面 JSON 缓存重新提取
  --help            显示帮助
`)
}

function parseArgs(argv) {
  const opts = { units: [], noUpload: false, uploadOnly: false, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') return { help: true }
    if (arg === '--no-upload') opts.noUpload = true
    else if (arg === '--upload-only') opts.uploadOnly = true
    else if (arg === '--force') opts.force = true
    else if (arg === '--unit') {
      const n = Number.parseInt(argv[++i], 10)
      assertUnit(n)
      opts.units.push(n)
    } else if (arg === '--range') {
      const match = /^(\d+)-(\d+)$/.exec(argv[++i] ?? '')
      if (!match) throw new Error('--range 格式应为 A-B，如 --range 1-10')
      const [a, b] = [Number(match[1]), Number(match[2])]
      assertUnit(a)
      assertUnit(b)
      if (b < a) throw new Error('--range 起点必须 <= 终点')
      for (let n = a; n <= b; n += 1) opts.units.push(n)
    } else throw new Error(`Unknown option: ${arg}`)
  }
  if (opts.units.length === 0) throw new Error('需要 --unit <n> 或 --range <a-b>')
  return opts
}

function assertUnit(n) {
  if (!Number.isInteger(n) || n < 1 || n > 116) {
    throw new Error(`单元编号必须在 1-116 之间，收到: ${n}`)
  }
}

// ── page mapping ──────────────────────────────────────────────────────────────

function resolvePageMap(unitNumber) {
  if (existsSync(PAGE_MAP_PATH)) {
    const map = JSON.parse(readFileSync(PAGE_MAP_PATH, 'utf8'))
    const entry = map[String(unitNumber)]
    if (entry && Array.isArray(entry.pdf) && entry.pdf.length > 0) {
      return { pdf: entry.pdf, book: entry.book ?? entry.pdf, fromMap: true }
    }
    throw new Error(`grammar-page-map.json 缺少 unit ${unitNumber} 的条目`)
  }
  // Phase 1 临时公式：Unit 1 = PDF/印刷页 21-22，每单元两页
  console.warn(`⚠ unit ${unitNumber}: 未找到 grammar-page-map.json，使用临时公式 [19+2N, 20+2N]（Phase 2 --toc 会替换）`)
  const lesson = 19 + 2 * unitNumber
  return { pdf: [lesson, lesson + 1], book: [lesson, lesson + 1], fromMap: false }
}

// ── PDF rendering ─────────────────────────────────────────────────────────────

function renderPdfPage(pdfPage, force) {
  const stem = `page-${String(pdfPage).padStart(4, '0')}`
  const imagePath = resolve(PAGES_DIR, `${stem}.png`)
  if (!force && existsSync(imagePath)) return imagePath
  if (!existsSync(PDF_PATH)) throw new Error(`PDF 不存在: ${PDF_PATH}`)
  mkdirSync(PAGES_DIR, { recursive: true })
  const renderPrefix = resolve(PAGES_DIR, `${stem}-render`)
  execFileSync('pdftoppm', [
    '-f', String(pdfPage),
    '-l', String(pdfPage),
    '-singlefile',
    '-r', String(DPI),
    '-png',
    PDF_PATH,
    renderPrefix,
  ])
  renameSync(`${renderPrefix}.png`, imagePath)
  console.log(`[p.${pdfPage}] 渲染完成 (${DPI} DPI)`)
  return imagePath
}

// ── Vision extraction ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `你是一位英语语法教材内容的**逐字转录**专家。你的任务是**忠实地还原**图片中的全部教学内容，不要总结、不要改写、不要遗漏。

**输出要求**: 严格输出 JSON（不要 markdown 代码块包裹）。

{
  "unitNumber": <数字>,
  "title": "<英文标题，逐字抄写>",
  "titleZh": "<中文标题，逐字抄写>",
  "pageType": "lesson | exercise",
  "bookPage": <本页面角落标注的印刷页码数字；找不到则用你的最佳估计>,
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
8. sections 数组仅在 lesson 页用；exercise 页的 sections 为空数组
9. exercises 数组仅在 exercise 页使用；lesson 页的 exercises 为空数组
10. 如果图片中同时有讲解和练习（某些单元），两者都要提取`

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function extractFromImage(imagePath, pdfPage, apiKey, baseUrl) {
  const base64 = readFileSync(imagePath).toString('base64')
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`[p.${pdfPage}] 调用 ${VISION_MODEL}${attempt > 1 ? `（第 ${attempt} 次重试）` : ''}...`)
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          max_tokens: 16384,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                { type: 'text', text: EXTRACTION_PROMPT },
              ],
            },
          ],
        }),
      })
      if (!response.ok) {
        throw new Error(`API ${response.status}: ${await response.text()}`)
      }
      const result = await response.json()
      const raw = (result.choices?.[0]?.message?.content ?? '').trim()
      if (!raw) throw new Error('模型返回空内容')
      let cleaned = raw
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      const usage = result.usage ?? {}
      console.log(
        `[p.${pdfPage}] ✓ 提取完成（tokens: ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out）`,
      )
      return JSON.parse(cleaned)
    } catch (err) {
      lastError = err
      if (attempt < 3) await sleep(1500 * 2 ** (attempt - 1))
    }
  }
  throw new Error(`[p.${pdfPage}] 提取失败（已重试 3 次）: ${lastError.message}`)
}

// ── unit assembly ─────────────────────────────────────────────────────────────

function assembleUnit(unitNumber, pageResults, pageMap) {
  const lessonPages = pageResults.filter((p) => (p.data.sections ?? []).length > 0 || (p.data.crossReferences ?? []).length > 0)
  const exercisePages = pageResults.filter((p) => (p.data.exercises ?? []).length > 0)
  // 元数据以讲解页为准，缺失时用练习页
  const meta = lessonPages[0]?.data ?? exercisePages[0]?.data ?? {}

  const sections = []
  for (const page of lessonPages) {
    const bookPage = typeof page.data.bookPage === 'number' ? page.data.bookPage : page.expectedBookPage
    if (bookPage !== page.expectedBookPage) {
      console.warn(`⚠ unit ${unitNumber}: p.${page.pdfPage} 提取页码 ${bookPage} 与期望 ${page.expectedBookPage} 不一致（WARN，不中止）`)
    }
    for (const section of page.data.sections ?? []) {
      sections.push({ ...section, bookPage })
    }
  }
  const crossReferences = lessonPages.flatMap((p) => p.data.crossReferences ?? [])

  const exercises = []
  for (const page of exercisePages) {
    const bookPage = typeof page.data.bookPage === 'number' ? page.data.bookPage : page.expectedBookPage
    for (const group of page.data.exercises ?? []) {
      exercises.push({ ...group, bookPage })
    }
  }

  for (const data of pageResults.map((p) => p.data)) {
    if (data.unitNumber !== unitNumber) {
      console.warn(`⚠ unit ${unitNumber}: 提取结果的 unitNumber=${data.unitNumber} 与请求不一致（WARN）`)
    }
  }
  if (sections.length === 0 && exercises.length === 0) {
    throw new Error(`unit ${unitNumber}: lesson 与 exercises 均为空，拒绝入库`)
  }

  return {
    unit_number: unitNumber,
    title: meta.title ?? `Unit ${unitNumber}`,
    title_zh: meta.titleZh ?? '',
    category: meta.category ?? '',
    category_zh: meta.categoryZh ?? '',
    difficulty: meta.difficulty ?? 1,
    book_pages: pageMap.book,
    lesson: { sections, crossReferences },
    exercises,
  }
}

// ── upload ────────────────────────────────────────────────────────────────────

async function upsertUnit(row, env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('入库需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（apps/web/.env.local）')
  }
  const response = await fetch(`${url}/rest/v1/grammar_units?on_conflict=unit_number`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) {
    throw new Error(`upsert 失败 ${response.status}: ${await response.text()}`)
  }
  console.log(`✓ unit ${row.unit_number} 已入库（title: ${row.title}，lesson sections: ${row.lesson.sections.length}，exercise groups: ${row.exercises.length}）`)
}

// ── per-unit flow ─────────────────────────────────────────────────────────────

async function processUnit(unitNumber, opts, env) {
  const unitDir = resolve(UNITS_DIR, `unit${String(unitNumber).padStart(3, '0')}`)
  mkdirSync(unitDir, { recursive: true })
  const unitJsonPath = resolve(unitDir, 'unit.json')

  if (opts.uploadOnly) {
    if (!existsSync(unitJsonPath)) {
      throw new Error(`unit ${unitNumber}: 未找到 ${unitJsonPath}，请先执行提取（去掉 --upload-only）`)
    }
    await upsertUnit(JSON.parse(readFileSync(unitJsonPath, 'utf8')), env)
    return
  }

  const pageMap = resolvePageMap(unitNumber)
  const apiKey = env.AI_EMBED_API_KEY
  const baseUrl = env.AI_EMBED_BASE_URL
  if (!apiKey || !baseUrl) {
    throw new Error('提取需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL（apps/web/.env.local）')
  }

  const pageResults = []
  for (let i = 0; i < pageMap.pdf.length; i += 1) {
    const pdfPage = pageMap.pdf[i]
    const expectedBookPage = pageMap.book[i] ?? pdfPage
    const rawJsonPath = resolve(unitDir, `page-${String(pdfPage).padStart(4, '0')}.json`)
    let data
    if (!opts.force && existsSync(rawJsonPath)) {
      console.log(`[p.${pdfPage}] 使用缓存 ${rawJsonPath}`)
      data = JSON.parse(readFileSync(rawJsonPath, 'utf8'))
    } else {
      const imagePath = renderPdfPage(pdfPage, opts.force)
      data = await extractFromImage(imagePath, pdfPage, apiKey, baseUrl)
      writeFileSync(rawJsonPath, JSON.stringify(data, null, 2) + '\n')
    }
    pageResults.push({ pdfPage, expectedBookPage, data })
  }

  const row = assembleUnit(unitNumber, pageResults, pageMap)
  writeFileSync(resolve(unitDir, 'lesson.json'), JSON.stringify(row.lesson, null, 2) + '\n')
  writeFileSync(resolve(unitDir, 'exercise.json'), JSON.stringify(row.exercises, null, 2) + '\n')
  writeFileSync(unitJsonPath, JSON.stringify(row, null, 2) + '\n')
  console.log(`✓ unit ${unitNumber} JSON 已落地: ${unitDir}`)

  if (!opts.noUpload) {
    await upsertUnit(row, env)
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return usage()
  const env = loadEnv()

  console.log('═'.repeat(60))
  console.log(`Grammar Extract — units: ${opts.units.join(', ')}${opts.uploadOnly ? '（upload-only）' : opts.noUpload ? '（no-upload）' : ''}`)
  console.log('═'.repeat(60))

  let failed = 0
  for (const unitNumber of opts.units) {
    try {
      await processUnit(unitNumber, opts, env)
    } catch (err) {
      failed += 1
      console.error(`✗ unit ${unitNumber}: ${err.message}`)
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} 个单元失败`)
    process.exit(1)
  }
  console.log('\n全部完成 🎉')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
