#!/usr/bin/env node

/**
 * Phase 2 页码映射生成 — 用 Vision LLM 读取 PDF 页面角落的印刷页码，
 * 与已知规律（book = pdf - offset）交叉验证，输出 scripts/grammar-page-map[-{book}].json。
 *
 * Usage:
 *   node scripts/grammar-page-map-gen.mjs --range 11-116 [--book essential|intermediate|advanced] [--offset N] [--force] [--dry-run]
 *
 * --book 默认 essential；essential 未显式传 --offset 时默认 7（已知规律 book = pdf - 7）。
 * 非 essential 未传 --offset 时跳过公式交叉验证（仅打印 LLM 识别值，需人工核对后再正式写入）。
 *
 * 产物：
 *   output/grammar-pages/page-NNNN.png（低 DPI 渲染缓存）
 *   scripts/grammar-page-map.json / grammar-page-map-{book}.json（合并已有条目后写入，--dry-run 只打印不写）
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 与 extract-grammar-unit.mjs 的 BOOKS 保持一致 */
const BOOKS = {
  essential: { pdf: 'docs/english/剑桥初级英语语法.pdf' },
  intermediate: { pdf: 'docs/english/剑桥中级英语语法.pdf' },
  advanced: { pdf: 'docs/english/剑桥高级英语语法.pdf' },
}
const DEFAULT_BOOK = 'essential'
const PAGES_DIR = resolve(root, 'output/grammar-pages')
const VISION_MODEL = process.env.GRAMMAR_VISION_MODEL || 'qwen-vl-max'
const DPI = 120 // 读页码用低 DPI 即可，节省渲染与传输成本

/** page-map 按书分文件：essential 保留历史文件名，其他书 grammar-page-map-{book}.json */
function pageMapPathFor(book) {
  if (book === 'essential') return resolve(root, 'scripts/grammar-page-map.json')
  return resolve(root, `scripts/grammar-page-map-${book}.json`)
}

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

function parseArgs(argv) {
  const opts = { pdfPages: [], force: false, dryRun: false, book: DEFAULT_BOOK, offset: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--force') opts.force = true
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--book') {
      opts.book = argv[++i] ?? ''
      if (!BOOKS[opts.book]) throw new Error(`--book 仅支持 ${Object.keys(BOOKS).join('/')}`)
    } else if (arg === '--offset') {
      opts.offset = Number(argv[++i])
      if (!Number.isFinite(opts.offset)) throw new Error('--offset 应为数字（book_page = pdf_page - offset）')
    } else if (arg === '--range') {
      const match = /^(\d+)-(\d+)$/.exec(argv[++i] ?? '')
      if (!match) throw new Error('--range 格式应为 A-B（PDF 页码区间）')
      for (let n = Number(match[1]); n <= Number(match[2]); n += 1) opts.pdfPages.push(n)
    } else if (arg === '--pdf-page') {
      opts.pdfPages.push(Number.parseInt(argv[++i], 10))
    } else throw new Error(`Unknown option: ${arg}`)
  }
  if (opts.pdfPages.length === 0) throw new Error('需要 --range <a-b> 或 --pdf-page <n>')
  return opts
}

function renderPdfPage(pdfPath, pdfPage, force) {
  const stem = `page-${String(pdfPage).padStart(4, '0')}`
  const imagePath = resolve(PAGES_DIR, `${stem}.png`)
  // 已有高 DPI 版本则直接复用
  if (existsSync(imagePath)) return imagePath
  mkdirSync(PAGES_DIR, { recursive: true })
  const renderPrefix = resolve(PAGES_DIR, `${stem}-pm`)
  execFileSync('pdftoppm', [
    '-f', String(pdfPage),
    '-l', String(pdfPage),
    '-singlefile',
    '-r', String(DPI),
    '-png',
    pdfPath,
    renderPrefix,
  ])
  renameSync(`${renderPrefix}.png`, imagePath)
  return imagePath
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const PAGE_READ_PROMPT = `这是一本英语语法教材的扫描页。请只回答该页面上印刷的页码数字（通常在页面角落，阿拉伯数字）。
如果有多个数字，选择页面最外侧（左上或右上角落）的印刷页码。
只输出一个整数，不要输出任何其他文字。如果确实找不到任何印刷页码，输出 NONE。`

async function readPageNumber(imagePath, pdfPage, apiKey, baseUrl, cache) {
  const cacheKey = String(pdfPage)
  if (cache[cacheKey] != null) return cache[cacheKey]
  const base64 = readFileSync(imagePath).toString('base64')
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          max_tokens: 16,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                { type: 'text', text: PAGE_READ_PROMPT },
              ],
            },
          ],
        }),
      })
      if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`)
      const result = await response.json()
      const raw = (result.choices?.[0]?.message?.content ?? '').trim()
      if (raw === 'NONE' || raw === '') return (cache[cacheKey] = null)
      const num = Number(raw)
      if (!Number.isInteger(num)) throw new Error(`无法解析页码输出: "${raw}"`)
      return (cache[cacheKey] = num)
    } catch (err) {
      lastError = err
      if (attempt < 3) await sleep(1500 * 2 ** (attempt - 1))
    }
  }
  throw new Error(`[p.${pdfPage}] 页码读取失败: ${lastError.message}`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const pdfPath = resolve(root, BOOKS[opts.book].pdf)
  if (!existsSync(pdfPath)) {
    throw new Error(`book "${opts.book}" 的 PDF 不存在: ${pdfPath}，请先将 PDF 放入 docs/english/`)
  }
  const env = loadEnv()
  const apiKey = env.AI_EMBED_API_KEY
  const baseUrl = env.AI_EMBED_BASE_URL
  if (!apiKey || !baseUrl) throw new Error('需要 AI_EMBED_API_KEY 与 AI_EMBED_BASE_URL')

  // essential 未显式传 --offset 时保持历史默认 7；其他书未传则跳过公式交叉验证
  const offset = opts.offset ?? (opts.book === 'essential' ? 7 : null)
  if (offset === null) {
    console.warn(`⚠ book "${opts.book}" 未提供 --offset：跳过公式交叉验证，请人工核对 LLM 识别页码后再正式写入`)
  }

  const pageMapPath = pageMapPathFor(opts.book)
  // LLM 页码缓存按书区分，避免两本书的缓存串号
  const cachePath = resolve(root, `output/grammar-page-num-cache-${opts.book}.json`)
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  const map = existsSync(pageMapPath) ? JSON.parse(readFileSync(pageMapPath, 'utf8')) : {}

  const mismatches = []
  let i = 0
  for (const pdfPage of opts.pdfPages) {
    i += 1
    const imagePath = renderPdfPage(pdfPath, pdfPage, opts.force)
    const readNum = await readPageNumber(imagePath, pdfPage, apiKey, baseUrl, cache)
    if (offset === null) {
      console.log(`[${i}/${opts.pdfPages.length}] pdf=${pdfPage} 印刷页码=${readNum ?? 'NONE'}（无 offset，未交叉验证）`)
    } else {
      const expected = pdfPage - offset
      const mark = readNum === expected ? '✓' : readNum === null ? '?' : '✗'
      console.log(`[${i}/${opts.pdfPages.length}] pdf=${pdfPage} 印刷页码=${readNum ?? 'NONE'} 期望=${expected} ${mark}`)
      if (readNum !== expected) mismatches.push({ pdfPage, readNum, expected })
    }
    if (i % 10 === 0) writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n')
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n')

  // 按单元组装：essential 规律 Unit N = PDF 页 [19+2N, 20+2N]；
  // 其他书接入时版式规律未知，暂沿用同形公式（接入前必须按实际版式核对此处）
  const updated = {}
  for (let unit = 1; unit <= 116; unit += 1) {
    const pdf = [19 + 2 * unit, 20 + 2 * unit]
    const book = pdf.map((p) => cache[String(p)])
    const existing = map[String(unit)]
    if (existing && !pdf.some((p) => opts.pdfPages.includes(p))) {
      updated[String(unit)] = existing
      continue
    }
    if (book.some((b) => b == null)) {
      if (existing) {
        updated[String(unit)] = existing
        console.warn(`⚠ unit ${unit}: PDF 页 ${pdf.join(',')} 有读不出的页码，保留原条目`)
      } else {
        console.warn(`⚠ unit ${unit}: PDF 页 ${pdf.join(',')} 有读不出的页码，无原条目，跳过`)
      }
      continue
    }
    updated[String(unit)] = { pdf, book }
  }

  if (mismatches.length > 0) {
    console.log(`\n⚠ ${mismatches.length} 处与规律 (pdf-${offset}) 不一致，需人工核对：`)
    for (const m of mismatches) console.log(`  pdf=${m.pdfPage} LLM读出=${m.readNum} 规律期望=${m.expected}`)
  }

  if (opts.dryRun) {
    console.log('\n--dry-run: 未写入 page-map')
    return
  }
  writeFileSync(pageMapPath, JSON.stringify(updated, null, 2) + '\n')
  console.log(`\n✓ page-map 已写入 ${Object.keys(updated).length} 个单元（${pageMapPath}）`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
