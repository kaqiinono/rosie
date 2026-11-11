#!/usr/bin/env node
/**
 * 视觉规范守卫（规范见 docs/visual-guidelines.md）。
 *
 * 禁止「塑料感」写法：渐变、柔和模糊投影、毛玻璃；以及手写卡片 / 页头、原生控件（native-control）。
 * 历史代码里已有的写法记录在 scripts/visual-style-baseline.json（技术债清单），采用「只减不增」：
 *   - 某文件某规则的命中数超过基线 → 失败（新增了塑料写法）
 *   - 命中数低于基线 → 通过，并提示运行 --update 收紧基线
 *
 * 用法：
 *   node scripts/check-visual-style.mjs            检查
 *   node scripts/check-visual-style.mjs --update   把基线收紧到当前值（拒绝上调）
 *   node scripts/check-visual-style.mjs --report   按目录汇总剩余债务
 *   node scripts/check-visual-style.mjs --files    按文件列出剩余债务（可加路径前缀过滤，如 --files packages/chinese）
 *
 * 个别必须保留的写法（如深色播放器、封面图遮罩），在同一行或上一行写注释 `visual-ok: 原因` 豁免。
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BASELINE_FILE = resolve(import.meta.dirname, 'visual-style-baseline.json')
const SOURCE_ROOTS = ['apps', 'packages']
const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.next-dev', 'tests', '__tests__'])
// Radix 控件层与全局令牌层本身定义这套语言（含弹窗遮罩模糊），不计入。
const EXEMPT_FILES = new Set(['packages/ui/src/themes.css'])
// 整个目录不检查：即将废弃的页面，不值得清理。
const EXEMPT_DIRS = ['packages/flipbook/']

// CSS / 行内样式写法的模糊投影：`0 4px 20px rgba(...)`（模糊半径 > 0）。text-shadow、drop-shadow 不计。
const INLINE_BLUR_SHADOW =
  /(?<![\w.-])(?<!\d\s)(?<!px\s)-?\d+(?:px)?\s+-?\d+(?:px)?\s+[1-9]\d*px\s+(?:-?\d+(?:px)?\s+)?(?:rgba?\(|#[0-9a-fA-F]{3}|var\(|color-mix\()/g
const SKIP_INLINE_SHADOW_LINE = /text-?[sS]hadow|drop-shadow|filter\s*:/

const RULES = {
  gradient: {
    pattern: /\bbg-gradient-to-|\bbg-(?:linear|radial|conic)-|(?:linear|radial|conic)-gradient\(/g,
    hint: '渐变会带来塑料光泽。用纯色（--accent-* / amber-* 等）加 border-2 与 shadow-sticker*。',
  },
  'soft-shadow': {
    pattern:
      /(?<![\w-])shadow-(?:sm|md|lg|xl|2xl)\b|\bdrop-shadow-(?:sm|md|lg|xl|2xl)\b|(?<!drop-)\bshadow-\[[^\]\s]*?\d+(?:px)?_-?\d+px_\d+px/g,
    hint: '柔和模糊投影显得悬浮、塑料。用 shadow-sticker-sm / shadow-sticker / shadow-sticker-lg（平的底边）。',
  },
  glass: {  // 含 backdrop-blur 与 blur-* 模糊光斑
    pattern: /\bbackdrop-blur|\bbackdrop-filter\b|\bbackdropFilter\b|(?<![\w-])blur-(?:xs|sm|md|lg|xl|2xl|3xl|\[)/g,
    hint: '毛玻璃和模糊光斑偏成人化的科技感。用不透明的奶油 / 白色底（bg-kid-paper、bg-white）和纯色圆点。',
  },
  // 同一行里手写了「白底 + 圆角 + 贴纸阴影」= 自己拼了一张卡片。共享组件内部（packages/ui）不计。
  'hand-card': {
    pattern:
      /^(?=.*\bshadow-sticker)(?=.*\b(?:bg-white|bg-kid-paper)\b)(?=.*(?<![\w-])rounded-(?:2xl|3xl|xl|lg|\[\d+px\]))(?!.*rounded-full).*$/g,
    hint: '不要手写卡片。用 <StickerCard>（@rosie/ui）：tone / size / elevation / radius 选择外观，className 只管布局。',
    skipPathPrefix: 'packages/ui/',
  },
  // 手写粘性页头 = 自己拼页面外壳。业务页用 <PageShell>（返回 / 标题 / 右侧操作 / 宽度 / 底色）。
  'hand-header': {
    pattern: /(?=.*\bsticky\b)(?=.*\btop-0\b)(?=.*\bz-(?:10|20|30|40|50)\b).*\bheader\b|<header\b[^>]*\bsticky\b[^>]*\btop-0\b/g,
    hint: '不要手写粘性页头。用 <PageShell>（@rosie/ui）：title / icon / backHref / actions / width / tone。',
    skipPathPrefix: 'packages/ui/',
  },
  // 原生控件 = 自己拼按钮 / 输入框 / 下拉。业务页用 @rosie/ui/themes（Radix）的 Button / IconButton / TextField / TextArea / Select。
  // 深色沉浸的口算（packages/calc）由 Radix 深色主题范围单独处理，不计入。
  'native-control': {
    pattern: /<(?:button|select|textarea|input)\b/g,
    hint: '不要手写原生 <button> / <input> / <select> / <textarea>。用 @rosie/ui/themes 的 Button / IconButton / TextField.Root / TextArea / Select；纯色色块、自绘棋盘格等非标准控件加 `native-ok: 原因`。',
    skipPathPrefix: ['packages/ui/', 'packages/calc/', 'apps/web/src/app/calc/', 'apps/web/src/app/admin/calc/'],
    exemptMarker: 'native-ok',
  },
}

async function sourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)))
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path)
  }
  return files
}

// 复选框 / 单选 / 文件 / 滑块 / 隐藏 / 取色 input 没有对应的 Radix 文本控件，不计入 native-control（Prettier 可能把属性拆成多行，所以向下看一个窗口）。
function nonTextInputs(lines, index) {
  const line = lines[index]
  const window = lines.slice(index, index + 12).join('\n')
  let skipped = 0
  let from = 0
  for (const match of line.matchAll(/<input\b/g)) {
    const offset = window.indexOf('<input', from)
    from = offset + 1
    const tag = window.slice(offset).split('/>')[0]
    if (/type=["'](?:checkbox|radio|file|range|hidden|color)["']/.test(tag)) skipped += 1
    void match
  }
  return skipped
}

function countViolations(source, repoPath = '') {
  const lines = source.split('\n')
  const counts = {}
  lines.forEach((line, index) => {
    if (line.includes('visual-ok') || lines[index - 1]?.includes('visual-ok')) return
    for (const [name, { pattern, skipPathPrefix, exemptMarker }] of Object.entries(RULES)) {
      if (skipPathPrefix && [skipPathPrefix].flat().some((prefix) => repoPath.startsWith(prefix))) continue
      if (exemptMarker && (line.includes(exemptMarker) || lines[index - 1]?.includes(exemptMarker))) continue
      let n = line.match(pattern)?.length ?? 0
      if (name === 'native-control') n -= nonTextInputs(lines, index)
      if (name === 'soft-shadow' && !SKIP_INLINE_SHADOW_LINE.test(line)) {
        n += line.match(INLINE_BLUR_SHADOW)?.length ?? 0
      }
      if (n > 0) counts[name] = (counts[name] ?? 0) + n
    }
  })
  return counts
}

async function scan() {
  const result = {}
  for (const sourceRoot of SOURCE_ROOTS) {
    for (const file of await sourceFiles(resolve(ROOT, sourceRoot))) {
      const repoPath = relative(ROOT, file).split('\\').join('/')
      if (EXEMPT_FILES.has(repoPath) || EXEMPT_DIRS.some((d) => repoPath.startsWith(d))) continue
      const counts = countViolations(await readFile(file, 'utf8'), repoPath)
      if (Object.keys(counts).length > 0) result[repoPath] = counts
    }
  }
  return result
}

async function readBaseline() {
  try {
    return JSON.parse(await readFile(BASELINE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function total(map) {
  const sum = {}
  for (const counts of Object.values(map)) {
    for (const [rule, n] of Object.entries(counts)) sum[rule] = (sum[rule] ?? 0) + n
  }
  return sum
}

function diff(current, baseline) {
  const increases = []
  const decreases = []
  for (const file of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    for (const rule of Object.keys(RULES)) {
      const now = current[file]?.[rule] ?? 0
      const before = baseline[file]?.[rule] ?? 0
      if (now > before) increases.push({ file, rule, now, before })
      else if (now < before) decreases.push({ file, rule, now, before })
    }
  }
  return { increases, decreases }
}

const args = new Set(process.argv.slice(2))
const current = await scan()
const baseline = await readBaseline()

if (args.has('--files')) {
  const prefix = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? ''
  const rows = Object.entries(current)
    .filter(([file]) => file.startsWith(prefix))
    .map(([file, c]) => ({ file, c, sum: Object.values(c).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.sum - a.sum)
  for (const { file, c, sum } of rows) console.log(String(sum).padStart(4), JSON.stringify(c).padEnd(46), file)
  process.exit(0)
}

if (args.has('--report')) {
  const byDirectory = {}
  for (const [file, counts] of Object.entries(current)) {
    const key = file.split('/').slice(0, 2).join('/')
    byDirectory[key] ??= {}
    for (const [rule, n] of Object.entries(counts)) byDirectory[key][rule] = (byDirectory[key][rule] ?? 0) + n
  }
  const rows = Object.entries(byDirectory)
    .map(([dir, c]) => ({ dir, ...c, sum: Object.values(c).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.sum - a.sum)
  console.log('目录'.padEnd(26), ...Object.keys(RULES).map((r) => r.padStart(12)), '合计'.padStart(8))
  for (const row of rows) {
    console.log(row.dir.padEnd(26), ...Object.keys(RULES).map((r) => String(row[r] ?? 0).padStart(12)), String(row.sum).padStart(8))
  }
  const sum = total(current)
  console.log('合计'.padEnd(26), ...Object.keys(RULES).map((r) => String(sum[r] ?? 0).padStart(12)), String(Object.values(sum).reduce((a, b) => a + b, 0)).padStart(8))
  process.exit(0)
}

const { increases, decreases } = diff(current, baseline)

if (args.has('--update')) {
  // 基线为空（首次建立）时允许写入；之后只能下调。
  if (increases.length > 0 && Object.keys(baseline).length > 0) {
    console.error('拒绝更新：以下文件新增了塑料写法，基线只能下调不能上调。请先修复：')
    for (const { file, rule, now, before } of increases) console.error(`- ${file} [${rule}] ${before} → ${now}`)
    process.exit(1)
  }
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(BASELINE_FILE, JSON.stringify(sorted, null, 2) + '\n')
  const sum = total(sorted)
  console.log(`基线已更新：${Object.entries(sum).map(([r, n]) => `${r} ${n}`).join('，') || '无遗留'}`)
  process.exit(0)
}

if (increases.length > 0) {
  console.error('视觉规范检查失败：新增了「塑料感」写法（见 docs/visual-guidelines.md）：')
  for (const { file, rule, now, before } of increases) {
    console.error(`- ${file} [${rule}] 基线 ${before}，当前 ${now}\n    ${RULES[rule].hint}`)
  }
  console.error('确需保留时，在该行或上一行加注释 `visual-ok: 原因`。')
  process.exit(1)
}

const sum = total(current)
console.log(`视觉规范检查通过。遗留债务：${Object.entries(sum).map(([r, n]) => `${r} ${n}`).join('，') || '无'}`)
if (decreases.length > 0) {
  console.log(`有 ${decreases.length} 处已清理，运行 \`pnpm lint:visual --update\` 收紧基线。`)
}
