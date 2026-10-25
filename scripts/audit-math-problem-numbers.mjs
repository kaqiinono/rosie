#!/usr/bin/env node
/** Read-only local metadata audit. No env, network, database or file writes.
 * node scripts/audit-math-problem-numbers.mjs [--lesson 2-10] [--json] [--strict]
 * See docs/add-new-lesson/data.md for numbering and manual acceptance.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
let lessonFilter
let json = false
let strict = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') json = true
  else if (args[i] === '--strict') strict = true
  else if (args[i] === '--lesson' && /^\d+-\d+$/.test(args[i + 1] ?? '')) lessonFilter = args[++i]
  else throw new Error(`Unknown or incomplete argument: ${args[i]}`)
}

/** Run only local data declarations in a capability-free context, never imported UI.
 * Known figure/checker factories do not own id/title/displayId. Stub only these;
 * an unknown import fails the audit rather than silently omitting its data.
 */
function loadMetadata(relativePath) {
  const source = readFileSync(join(root, relativePath), 'utf8')
  const module = { exports: {} }
  const code = ts.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  const requireMetadata = (name) => {
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'fragment' }
    if (/^@rosie\/math-content\/components\/lesson\/g\d+\/lesson\d+\/Figure\//.test(name)) {
      return { __esModule: true, default: () => null }
    }
    if (name === '@rosie/math-content/components/lesson/g1/lesson47/gong/create-gong-problem') {
      return Object.fromEntries([
        'gongBudengSudoku', 'gongChangguiSudoku', 'gongChuangkouSudoku',
        'gongDuijiaoxianSudoku', 'gongJuchiSudoku', 'gongShufang',
        'gongShulian', 'gongShuqiao', 'gongWumaSudoku',
      ].map((key) => [key, () => ({})]))
    }
    if (name === '@rosie/math-kit/utils/vertical-digit-puzzle') {
      return { makeVerticalPuzzleChecker: () => () => null, makeVerticalPuzzleSymChecker: () => () => null }
    }
    throw new Error(`Unsupported metadata import in ${relativePath}: ${name}`)
  }
  vm.runInNewContext(code, { module, exports: module.exports, require: requireMetadata }, {
    filename: relativePath,
    timeout: 5000,
  })
  return module.exports
}

const { problemDisplayId, problemIdSuffix } = loadMetadata('packages/math-kit/src/utils/problem-display-id.ts')
const review = JSON.parse(readFileSync(join(root, 'scripts/math-problem-numbering-review.json'), 'utf8'))
const legacyLessons = new Set(review.reviewedLessons)
const issues = []
const lessons = []
const contentDir = join(root, 'packages/math-content/src/utils')
const suffixPattern = /^[PLHWS][1-9]\d*(?:-[1-9]\d*)?[a-z]?$/

for (const grade of readdirSync(contentDir).filter((name) => /^g\d+$/.test(name)).sort()) {
  for (const file of readdirSync(join(contentDir, grade)).filter((name) => /^lesson\d+-data\.tsx?$/.test(name)).sort()) {
    const lessonKey = `${grade.slice(1)}-${file.match(/^lesson(\d+)/)[1]}`
    if (lessonFilter && lessonFilter !== lessonKey) continue
    const relativePath = `packages/math-content/src/utils/${grade}/${file}`
    try {
      const { PROBLEMS } = loadMetadata(relativePath)
      if (!PROBLEMS || !Array.isArray(PROBLEMS.lesson)) throw new Error('Missing PROBLEMS.lesson')
      const realIds = new Map()
      const displayIds = new Map()
      const problems = []
      for (const [section, list] of Object.entries(PROBLEMS)) {
        if (!Array.isArray(list)) throw new Error(`Unsupported section: ${section}`)
        for (const problem of list) {
          if (typeof problem.id !== 'string' || typeof problem.title !== 'string') throw new Error(`Missing id/title in ${section}`)
          const displayId = problemDisplayId(problem)
          const row = { id: problem.id, displayId, title: problem.title, section }
          problems.push(row)
          const report = (kind, detail) => issues.push({ lessonKey, ...row, kind, detail })
          if (realIds.has(problem.id)) report('duplicate-id', `Also used in ${realIds.get(problem.id)}`)
          realIds.set(problem.id, section)
          if (displayIds.has(displayId)) report('duplicate-display-id', `Also used by ${displayIds.get(displayId)}`)
          displayIds.set(displayId, problem.id)
          if (!problem.id.startsWith(`${lessonKey}-`) || !suffixPattern.test(problemIdSuffix(problem.id))) report('invalid-id', 'Expected lessonKey plus a complete question suffix')
          if (typeof displayId !== 'string' || !suffixPattern.test(displayId)) report('invalid-display-id', 'Invalid complete display suffix')
          if (problem.displayId !== undefined && (!legacyLessons.has(lessonKey) || section !== 'lesson')) report('unexpected-display-id', 'displayId is only for reviewed legacy classroom problems')
          if (problem.displayId !== undefined && problem.displayId === problemIdSuffix(problem.id)) report('redundant-display-id', 'Already conforms without an override')
        }
      }
      lessons.push({ lessonKey, file: relativePath, problems })
    } catch (error) {
      issues.push({ lessonKey, kind: 'load-error', detail: error.message })
    }
  }
}

if (lessonFilter && !lessons.some((lesson) => lesson.lessonKey === lessonFilter) && !issues.length) {
  issues.push({ lessonKey: lessonFilter, kind: 'unknown-lesson', detail: 'No matching data file' })
}
for (const item of review.pending) {
  if (lessonFilter && item.lessonKey !== lessonFilter) continue
  const lesson = lessons.find((entry) => entry.lessonKey === item.lessonKey)
  // A load failure already reports incomplete coverage. Do not pretend it was reviewed.
  if (!lesson) continue
  const problem = lesson.problems.find((entry) => entry.id === item.id)
  issues.push({ ...item, kind: !problem || problem.title !== item.title || problem.displayId !== problemIdSuffix(item.id) ? 'stale-review' : 'pending', detail: item.reason })
}

const result = { lessons, issues }
if (json) console.log(JSON.stringify(result, null, 2))
else {
  for (const lesson of lessons) console.log(`${lesson.lessonKey}: ${lesson.problems.length} problems, ${lesson.problems.filter((p) => p.section === 'lesson').length} classroom`)
  for (const issue of issues) console.log(`[${issue.kind}] ${issue.lessonKey} ${issue.id ?? ''} ${issue.title ?? ''}: ${issue.detail}`)
  console.log(`${lessons.length} lessons; ${issues.length} findings (pending items retain their existing numbers).`)
}
process.exitCode = issues.some((issue) => strict || issue.kind !== 'pending') ? 1 : 0
