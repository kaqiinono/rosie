#!/usr/bin/env node
/**
 * 根据 PDF 页数 + 音频时长/静音点，生成 flipbook sync.json
 *
 * 用法：
 *   node scripts/generate-flipbook-sync.mjs --pdf 讲义.pdf --audio 讲解.mp3
 *   node scripts/generate-flipbook-sync.mjs --pdf a.pdf --audio a.mp3 --out a.sync.json --mode silence
 *   node scripts/generate-flipbook-sync.mjs --dir ./资料 --mode equal
 *
 * 模式：
 *   equal   — 按页数均分音频时长（零依赖，适合先出草稿再手调）
 *   silence — 用 ffmpeg silencedetect 在静音处切分（需安装 ffmpeg）
 *
 * 说明：无法从 PDF+音频「魔法」得到完美页码时间轴；讲题口播若在页与页之间有停顿，
 * silence 模式通常比 equal 更接近真实。若要按讲义文字对齐，需 Whisper 等 ASR（见文档）。
 */
import fs from 'fs'
import path from 'path'
import { execSync, spawnSync } from 'child_process'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'

const require = createRequire(import.meta.url)
const ROOT = path.join(import.meta.dirname, '..')

function usage() {
  console.log(`
用法:
  node scripts/generate-flipbook-sync.mjs --pdf <file.pdf> --audio <file.mp3> [--out <sync.json>] [--mode equal|silence]
  node scripts/generate-flipbook-sync.mjs --dir <folder> [--mode equal|silence]

选项:
  --mode equal     均分时长（默认）
  --mode silence   按静音切分（需 ffmpeg）
  --pages 1,3,5    只同步指定页（默认 1..N）
  --min-silence 0.8   silence 模式：最短静音秒数
  --noise -35dB       silence 模式：静音阈值
`)
}

function parseArgs(argv) {
  const args = { mode: 'equal', minSilence: 0.8, noise: '-35dB' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pdf') args.pdf = argv[++i]
    else if (a === '--audio') args.audio = argv[++i]
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--dir') args.dir = argv[++i]
    else if (a === '--mode') args.mode = argv[++i]
    else if (a === '--pages') args.pages = argv[++i].split(',').map((n) => parseInt(n, 10))
    else if (a === '--min-silence') args.minSilence = parseFloat(argv[++i])
    else if (a === '--noise') args.noise = argv[++i]
    else if (a === '-h' || a === '--help') args.help = true
  }
  return args
}

function fileStem(filename) {
  const base = path.basename(filename)
  return base
    .replace(/\.(pdf|mp3|m4a|wav|aac)$/i, '')
    .replace(/\.sync$/i, '')
    .trim()
    .toLowerCase()
}

async function getPdfPageCount(pdfPath) {
  const pdfjs = await import('pdfjs-dist')
  const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjs.getDocument({ data }).promise
  const n = doc.numPages
  await doc.destroy()
  return n
}

function getAudioDurationSec(audioPath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${JSON.stringify(audioPath)}`,
      { encoding: 'utf8' },
    )
    const d = parseFloat(out.trim())
    if (!Number.isFinite(d) || d <= 0) throw new Error('invalid duration')
    return d
  } catch {
    console.error('需要 ffprobe（随 ffmpeg 安装）以读取音频时长')
    process.exit(1)
  }
}

function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  return r.status === 0
}

/** @returns {number[]} speech segment start times after each silence_end */
function detectSilenceBoundaries(audioPath, minSilence, noise) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      audioPath,
      '-af',
      `silencedetect=noise=${noise}:d=${minSilence}`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  const text = (r.stderr || '') + (r.stdout || '')
  const ends = []
  for (const line of text.split('\n')) {
    const m = line.match(/silence_end:\s*([\d.]+)/)
    if (m) ends.push(parseFloat(m[1]))
  }
  return ends.filter((t) => t > 0.05)
}

/**
 * @param {number} pageCount
 * @param {number} durationSec
 * @param {number[]} boundaries - candidate split times (seconds)
 * @param {number[]} pageNumbers - 1-based page indices to emit
 */
function buildCues(pageNumbers, durationSec, boundaries) {
  const n = pageNumbers.length
  if (n === 0) return []

  let splits = boundaries.slice().sort((a, b) => a - b)
  const need = n - 1

  if (splits.length < need) {
    const step = durationSec / n
    for (let i = 1; i < n; i++) splits.push(step * i)
    splits.sort((a, b) => a - b)
  } else if (splits.length > need) {
    const picked = []
    for (let i = 0; i < need; i++) {
      const idx = Math.round(((i + 1) / (need + 1)) * (splits.length - 1))
      picked.push(splits[idx])
    }
    splits = picked.sort((a, b) => a - b)
  } else {
    splits = splits.slice(0, need)
  }

  const pages = []
  let start = 0
  for (let i = 0; i < n; i++) {
    const end = i < n - 1 ? splits[i] : durationSec
    pages.push({
      page: pageNumbers[i],
      start: round2(start),
      end: round2(end),
    })
    start = end
  }
  return pages
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function buildManifest(pages, mode) {
  return {
    version: 1,
    mode: 'auto_turn',
    _generatedBy: `generate-flipbook-sync.mjs (${mode})`,
    _note: '自动生成的草稿，建议在播放器中试听并手调 start/end',
    pages,
  }
}

async function generateOne({ pdfPath, audioPath, outPath, mode, pageList, minSilence, noise }) {
  const pageCount = await getPdfPageCount(pdfPath)
  const duration = getAudioDurationSec(audioPath)
  const pageNumbers =
    pageList && pageList.length > 0
      ? pageList.filter((p) => p >= 1 && p <= pageCount)
      : Array.from({ length: pageCount }, (_, i) => i + 1)

  if (pageNumbers.length === 0) {
    throw new Error(`无有效页码（PDF 共 ${pageCount} 页）`)
  }

  let boundaries = []
  if (mode === 'silence') {
    if (!hasFfmpeg()) throw new Error('silence 模式需要安装 ffmpeg')
    boundaries = detectSilenceBoundaries(audioPath, minSilence, noise)
  } else if (mode === 'equal') {
    const n = pageNumbers.length
    for (let i = 1; i < n; i++) boundaries.push((duration / n) * i)
  } else {
    throw new Error(`未知模式: ${mode}`)
  }

  const pages = buildCues(pageNumbers, duration, boundaries)
  const manifest = buildManifest(pages, mode)
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`✅ ${outPath}  （${pageNumbers.length} 段，音频 ${round2(duration)}s，模式 ${mode}）`)
}

function findPairsInDir(dir) {
  const names = fs.readdirSync(dir)
  const pdfs = names.filter((n) => /\.pdf$/i.test(n)).map((n) => path.join(dir, n))
  const pairs = []
  for (const pdf of pdfs) {
    const stem = fileStem(pdf)
    const audio = names.find((n) => {
      const s = fileStem(n)
      return s === stem && /\.(mp3|m4a|wav|aac)$/i.test(n)
    })
    if (!audio) {
      console.warn(`⚠ 跳过（无音频）: ${path.basename(pdf)}`)
      continue
    }
    pairs.push({ pdf, audio: path.join(dir, audio), stem })
  }
  return pairs
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help || (!args.pdf && !args.dir)) {
    usage()
    process.exit(args.help ? 0 : 1)
  }

  if (args.mode === 'silence' && !hasFfmpeg()) {
    console.error('silence 模式需要系统已安装 ffmpeg')
    process.exit(1)
  }

  if (args.dir) {
    const pairs = findPairsInDir(args.dir)
    for (const { pdf, audio, stem } of pairs) {
      const out = path.join(args.dir, `${stem}.sync.json`)
      await generateOne({
        pdfPath: pdf,
        audioPath: audio,
        outPath: out,
        mode: args.mode,
        pageList: args.pages,
        minSilence: args.minSilence,
        noise: args.noise,
      })
    }
    return
  }

  if (!args.pdf || !args.audio) {
    console.error('单本模式需要 --pdf 与 --audio')
    process.exit(1)
  }

  const out =
    args.out ||
    path.join(
      path.dirname(args.audio),
      `${fileStem(path.basename(args.audio))}.sync.json`,
    )

  await generateOne({
    pdfPath: args.pdf,
    audioPath: args.audio,
    outPath: out,
    mode: args.mode,
    pageList: args.pages,
    minSilence: args.minSilence,
    noise: args.noise,
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
