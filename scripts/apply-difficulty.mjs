/**
 * Inserts `difficulty: N` into all lesson*-data files.
 * Run: node scripts/apply-difficulty.mjs
 */
import fs from 'fs'
import path from 'path'

const UTILS = path.join(import.meta.dirname, '..', 'src/utils')

/** @type {Record<string, number>} */
const MANUAL = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'difficulty-overrides.json'), 'utf8'),
)

const SECTION_KEYS = {
  PRETEST: 'pretest',
  LESSON: 'lesson',
  HOMEWORK: 'homework',
  WORKBOOK: 'workbook',
  SUPPLEMENT: 'supplement',
}

function clamp(n) {
  if (n <= 1) return 1
  if (n >= 5) return 5
  return Math.round(n)
}

function rate(ctx) {
  if (MANUAL[ctx.id] != null) return clamp(MANUAL[ctx.id])

  const { title, tag, section, index, total } = ctx
  const t = title
  let d = 2

  if (section === 'pretest') d = 2
  else if (section === 'lesson') d = 2
  else if (section === 'homework') d = 3
  else if (section === 'workbook') d = 3
  else if (section === 'supplement') d = 4

  if (section === 'lesson') {
    if (/练一练|练\d|练习/.test(t)) d += 1
    if (/例题|例\d/.test(t) && !/练/.test(t)) d = Math.max(1, d - 0.5)
  }

  if (section === 'workbook' && total > 0) {
    const progress = index / Math.max(total - 1, 1)
    if (progress >= 0.75) d += 1
    if (progress >= 0.9) d += 0.5
    const m = t.match(/闯关\s*(\d+)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 10) d = Math.max(d, 4)
      if (n >= 11) d = 5
    }
  }

  if (tag === 'type5') d = Math.max(d, 4)
  if (tag === 'type6') d = Math.max(d, 4)

  if (/最难|综合变化|综合策略|倒扣分|特殊|两步|变异|隐藏|反推|日期总和|循环|交错|奇偶/.test(t)) d += 1
  if (/基础|入门|测\s*1|课前测\s*1|例题\s*1|例\s*1|凑整法基础/.test(t)) d -= 1

  if (/^34-S\d+$/.test(ctx.id)) {
    const n = parseInt(ctx.id.slice(4), 10)
    if (n <= 30) d = 2
    else if (n <= 70) d = 3
    else d = 4
  }

  if (/10[01]\s*项|第\s*10[12]\s*个|100\s*项/.test(t)) d += 0.5

  return clamp(Math.round(d * 2) / 2)
}

function inferSection(content, pos) {
  const before = content.slice(0, pos)
  let sec = 'lesson'
  let bestPos = -1
  for (const [key, val] of Object.entries(SECTION_KEYS)) {
    const re = new RegExp(`(?:const ${key}|${val}:\\s*\\[)`, 'g')
    let m
    while ((m = re.exec(before)) !== null) {
      if (m.index > bestPos) {
        bestPos = m.index
        sec = val
      }
    }
  }
  return sec
}

function extractProblems(content) {
  const problems = []
  const finalAnsRe = /\bfinalAns:\s*-?\d+/g
  let m
  while ((m = finalAnsRe.exec(content)) !== null) {
    const before = content.slice(Math.max(0, m.index - 5000), m.index)
    const idTitleMatches = [...before.matchAll(/id:\s*'([^']+)',\s*title:\s*'([^']+)'/g)]
    if (!idTitleMatches.length) continue

    const last = idTitleMatches[idTitleMatches.length - 1]
    const id = last[1]
    const title = last[2]
    const absPos = m.index - before.length + last.index

    const afterId = before.slice(last.index)
    const tagM = afterId.match(/tag:\s*'([^']+)'/)
    const section = inferSection(content, absPos)

    problems.push({
      id,
      title,
      tag: tagM ? tagM[1] : '',
      section,
    })
  }

  const totals = {}
  for (const p of problems) totals[p.section] = (totals[p.section] || 0) + 1
  const seen = {}
  return problems.map(p => {
    const idx = seen[p.section] || 0
    seen[p.section] = idx + 1
    return { ...p, index: idx, total: totals[p.section] }
  })
}

function applyToFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8')
  const lessonNum = path.basename(filepath).match(/lesson(\d+)/)?.[1] ?? ''

  // Remove existing difficulty annotations
  content = content.replace(/\s*difficulty:\s*[1-5],/g, '')

  const problems = extractProblems(content)
  const ratings = new Map(problems.map(p => [p.id, rate({ ...p, lessonNum })]))

  // Pass 1: compact one-line headers (lesson34, lesson35, etc.)
  content = content.replace(
    /id:\s*'([^']+)',\s*title:\s*'([^']*)',\s*tag:\s*'([^']*)',\s*tagLabel:\s*'([^']*)',/g,
    (full, id, _title, _tag, _tagLabel) => {
      const d = ratings.get(id)
      if (d == null) return full
      return `${full} difficulty: ${d},`
    },
  )

  // Pass 2: multiline — id line then title/tag/tagLabel on following lines
  for (const p of problems) {
    const d = ratings.get(p.id)
    if (d == null) continue
    const escapedId = p.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    if (content.includes(`id: '${p.id}'`) && content.includes(`difficulty: ${d},`)) {
      const checkRe = new RegExp(
        `id:\\s*'${escapedId}'[\\s\\S]{0,400}?difficulty:\\s*${d},`,
      )
      if (checkRe.test(content)) continue
    }

    const mlRe = new RegExp(
      `(id:\\s*'${escapedId}',\\s*\\n\\s*title:[^\\n]+,\\s*\\n\\s*tag:\\s*'[^']*',\\s*\\n\\s*tagLabel:\\s*'[^']*',)`,
      'm',
    )
    if (mlRe.test(content)) {
      content = content.replace(mlRe, `$1\n    difficulty: ${d},`)
    }
  }

  fs.writeFileSync(filepath, content)
  return problems.length
}

const files = fs
  .readdirSync(UTILS)
  .filter(f => /^lesson\d+-data\.tsx?$/.test(f))
  .sort()

let total = 0
for (const f of files) {
  const n = applyToFile(path.join(UTILS, f))
  console.log(`${f}: ${n} problems`)
  total += n
}
console.log(`Total: ${total}`)
