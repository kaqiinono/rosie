#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = {
  input: resolve(root, 'docs/english/剑桥初级英语语法.pdf'),
  output: resolve(root, 'output2/grammar-pilot/units-001-010'),
  firstPage: 21,
  lastPage: 40,
  dpi: 300,
  languages: 'eng+chi_sim',
  psm: 11,
  minConfidence: 60,
}

function usage() {
  console.log(`Usage: node scripts/extract-grammar-pdf.mjs [options]

Extracts a page range from a scanned grammar PDF. The default pilot covers the
first 10 units (PDF pages 21-40). Output includes rendered PNGs, plain OCR text, TSV-derived
layout blocks, and a manifest with quality warnings.

Options:
  --input <pdf>          Source PDF
  --output <dir>         Output directory
  --first-page <n>       First PDF page (default: 21)
  --last-page <n>        Last PDF page (default: 40)
  --dpi <n>              Render resolution (default: 300)
  --languages <langs>    Tesseract languages (default: eng+chi_sim)
  --psm <n>              Tesseract page segmentation mode (default: 11, sparse text)
  --min-confidence <n>   Low-confidence threshold (default: 60)
  --force                Rebuild cached pages
  --help                 Show this help
`)
}

function positiveInteger(value, flag) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${flag} must be a positive integer`)
  return parsed
}

function parseArgs(argv) {
  const options = { ...defaults, force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') return { help: true }
    if (arg === '--force') {
      options.force = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
    index += 1
    if (arg === '--input') options.input = resolve(root, value)
    else if (arg === '--output') options.output = resolve(root, value)
    else if (arg === '--first-page') options.firstPage = positiveInteger(value, arg)
    else if (arg === '--last-page') options.lastPage = positiveInteger(value, arg)
    else if (arg === '--dpi') options.dpi = positiveInteger(value, arg)
    else if (arg === '--languages') options.languages = value
    else if (arg === '--psm') options.psm = positiveInteger(value, arg)
    else if (arg === '--min-confidence') options.minConfidence = positiveInteger(value, arg)
    else throw new Error(`Unknown option: ${arg}`)
  }
  if (options.lastPage < options.firstPage) throw new Error('--last-page must be >= --first-page')
  if (options.minConfidence > 100) throw new Error('--min-confidence must be <= 100')
  return options
}

function requireCommand(command) {
  try {
    execFileSync(command, [command === 'pdftoppm' ? '-v' : '--version'], { stdio: 'ignore' })
  } catch {
    throw new Error(`Required command not found: ${command}`)
  }
}

function atomicWrite(path, content) {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, content)
  renameSync(temporary, path)
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseTsv(tsv, minConfidence) {
  const rows = tsv.trimEnd().split('\n')
  const headers = rows.shift()?.split('\t') ?? []
  const words = []
  for (const row of rows) {
    const columns = row.split('\t')
    const record = Object.fromEntries(
      headers.map((header, index) => [header, columns[index] ?? '']),
    )
    const text = record.text.trim()
    const confidence = Number(record.conf)
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue
    words.push({
      text,
      confidence: Math.round(confidence * 100) / 100,
      bbox: {
        x: Number(record.left),
        y: Number(record.top),
        width: Number(record.width),
        height: Number(record.height),
      },
      block: Number(record.block_num),
      paragraph: Number(record.par_num),
      line: Number(record.line_num),
      lowConfidence: confidence < minConfidence,
    })
  }

  const lineMap = new Map()
  for (const word of words) {
    const key = `${word.block}:${word.paragraph}:${word.line}`
    const current = lineMap.get(key) ?? []
    current.push(word)
    lineMap.set(key, current)
  }
  const lines = [...lineMap.values()].map((lineWords) => {
    lineWords.sort((a, b) => a.bbox.x - b.bbox.x)
    const left = Math.min(...lineWords.map((word) => word.bbox.x))
    const top = Math.min(...lineWords.map((word) => word.bbox.y))
    const right = Math.max(...lineWords.map((word) => word.bbox.x + word.bbox.width))
    const bottom = Math.max(...lineWords.map((word) => word.bbox.y + word.bbox.height))
    return {
      text: lineWords.map((word) => word.text).join(' '),
      confidence:
        Math.round(
          (lineWords.reduce((sum, word) => sum + word.confidence, 0) / lineWords.length) * 100,
        ) / 100,
      bbox: { x: left, y: top, width: right - left, height: bottom - top },
      words: lineWords,
    }
  })
  lines.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
  return { words, lines }
}

function imageDimensions(path) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
    encoding: 'utf8',
  })
  const width = Number(output.match(/pixelWidth: (\d+)/)?.[1])
  const height = Number(output.match(/pixelHeight: (\d+)/)?.[1])
  if (!width || !height) throw new Error(`Could not determine image size: ${path}`)
  return { width, height }
}

function run() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return usage()
  if (!existsSync(options.input)) throw new Error(`PDF not found: ${options.input}`)
  requireCommand('pdftoppm')
  requireCommand('tesseract')
  mkdirSync(options.output, { recursive: true })

  const sourceHash = sha256(options.input)
  const startedAt = new Date().toISOString()
  const pages = []
  for (let page = options.firstPage; page <= options.lastPage; page += 1) {
    const stem = `page-${String(page).padStart(4, '0')}`
    const imagePath = resolve(options.output, `${stem}.png`)
    const textPath = resolve(options.output, `${stem}.txt`)
    const tsvPath = resolve(options.output, `${stem}.tsv`)
    const jsonPath = resolve(options.output, `${stem}.json`)
    const cacheKey = createHash('sha256')
      .update(`${sourceHash}:${page}:${options.dpi}:${options.languages}:${options.psm}`)
      .digest('hex')

    let pageData
    if (!options.force && existsSync(jsonPath)) {
      const cached = JSON.parse(readFileSync(jsonPath, 'utf8'))
      if (cached.cacheKey === cacheKey && existsSync(imagePath) && existsSync(textPath)) {
        console.log(`[${page}] cached`)
        pages.push(cached)
        continue
      }
    }

    console.log(`[${page}] rendering at ${options.dpi} DPI`)
    const renderPrefix = resolve(options.output, `${stem}-render`)
    execFileSync('pdftoppm', [
      '-f',
      String(page),
      '-l',
      String(page),
      '-singlefile',
      '-r',
      String(options.dpi),
      '-png',
      options.input,
      renderPrefix,
    ])
    const renderedPath = `${renderPrefix}.png`
    renameSync(renderedPath, imagePath)

    console.log(`[${page}] OCR ${options.languages}, psm ${options.psm}`)
    const outputBase = resolve(options.output, `${stem}-ocr`)
    execFileSync('tesseract', [
      imagePath,
      outputBase,
      '-l',
      options.languages,
      '--psm',
      String(options.psm),
      'txt',
      'tsv',
    ])
    renameSync(`${outputBase}.txt`, textPath)
    renameSync(`${outputBase}.tsv`, tsvPath)

    const text = readFileSync(textPath, 'utf8').trim()
    const layout = parseTsv(readFileSync(tsvPath, 'utf8'), options.minConfidence)
    const dimensions = imageDimensions(imagePath)
    const confidences = layout.words.map((word) => word.confidence)
    const lowConfidenceWords = layout.words.filter((word) => word.lowConfidence)
    const meanConfidence = confidences.length
      ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
      : 0
    const warnings = []
    if (text.length < 20) warnings.push('very_little_text')
    if (meanConfidence < 80) warnings.push('low_mean_confidence')
    if (layout.words.length && lowConfidenceWords.length / layout.words.length > 0.1)
      warnings.push('many_low_confidence_words')
    if (/\.{4,}|_{3,}/.test(text)) warnings.push('fill_blank_layout_present')
    if (
      layout.lines.some(
        (line) => line.words.length >= 4 && line.bbox.width > dimensions.width * 0.65,
      )
    )
      warnings.push('wide_or_multi_column_lines_present')

    pageData = {
      cacheKey,
      pdfPage: page,
      image: basename(imagePath),
      textFile: basename(textPath),
      tsvFile: basename(tsvPath),
      dimensions,
      stats: {
        characters: text.length,
        words: layout.words.length,
        lines: layout.lines.length,
        meanConfidence: Math.round(meanConfidence * 100) / 100,
        lowConfidenceWords: lowConfidenceWords.length,
      },
      warnings,
      lines: layout.lines,
    }
    atomicWrite(jsonPath, `${JSON.stringify(pageData, null, 2)}\n`)
    pages.push(pageData)
  }

  const combinedText = pages
    .map(
      (page) =>
        `# PDF page ${page.pdfPage}\n\n${readFileSync(resolve(options.output, page.textFile), 'utf8').trim()}`,
    )
    .join('\n\n')
  atomicWrite(resolve(options.output, 'raw.md'), `${combinedText}\n`)

  const manifest = {
    schemaVersion: 1,
    source: {
      path: options.input.slice(root.length + 1),
      filename: basename(options.input),
      sha256: sourceHash,
    },
    extraction: {
      startedAt,
      completedAt: new Date().toISOString(),
      firstPage: options.firstPage,
      lastPage: options.lastPage,
      dpi: options.dpi,
      languages: options.languages,
      psm: options.psm,
      minConfidence: options.minConfidence,
    },
    pages: pages.map(({ lines, ...page }) => page),
    reviewRequired: pages.some((page) => page.warnings.length > 0),
  }
  atomicWrite(resolve(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Done: ${options.output}`)
  console.table(
    manifest.pages.map((page) => ({
      page: page.pdfPage,
      ...page.stats,
      warnings: page.warnings.join(', '),
    })),
  )
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
