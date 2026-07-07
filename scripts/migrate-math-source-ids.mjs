#!/usr/bin/env node
/**
 * Step 4: 源码讲次 ID / 路由迁移（problem id 前缀 + /math/ny/g{n}/{seq} 路径）
 * Usage: node scripts/migrate-math-source-ids.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const mathSrc = resolve(root, 'packages/math/src')

const LESSON_MAP = [
  { legacyId: '12', lessonKey: '1-12', grade: 1, seq: 12 },
  { legacyId: '13', lessonKey: '1-13', grade: 1, seq: 13 },
  { legacyId: '15', lessonKey: '1-15', grade: 1, seq: 15 },
  { legacyId: '18', lessonKey: '1-18', grade: 1, seq: 18 },
  { legacyId: '23', lessonKey: '1-23', grade: 1, seq: 23 },
  { legacyId: '29', lessonKey: '1-29', grade: 1, seq: 29 },
  { legacyId: '30', lessonKey: '1-30', grade: 1, seq: 30 },
  { legacyId: '34', lessonKey: '1-34', grade: 1, seq: 34 },
  { legacyId: '35', lessonKey: '1-35', grade: 1, seq: 35 },
  { legacyId: '36', lessonKey: '1-36', grade: 1, seq: 36 },
  { legacyId: '37', lessonKey: '1-37', grade: 1, seq: 37 },
  { legacyId: '38', lessonKey: '1-38', grade: 1, seq: 38 },
  { legacyId: '39', lessonKey: '1-39', grade: 1, seq: 39 },
  { legacyId: '40', lessonKey: '1-40', grade: 1, seq: 40 },
  { legacyId: '41', lessonKey: '1-41', grade: 1, seq: 41 },
  { legacyId: '42', lessonKey: '1-42', grade: 1, seq: 42 },
  { legacyId: '43', lessonKey: '1-43', grade: 1, seq: 43 },
  { legacyId: '44', lessonKey: '1-44', grade: 1, seq: 44 },
  { legacyId: '46', lessonKey: '1-46', grade: 1, seq: 46 },
  { legacyId: '47', lessonKey: '1-47', grade: 1, seq: 47 },
  { legacyId: '49', lessonKey: '2-1', grade: 2, seq: 1 },
  { legacyId: '50', lessonKey: '2-2', grade: 2, seq: 2 },
  { legacyId: '51', lessonKey: '2-3', grade: 2, seq: 3 },
  { legacyId: '52', lessonKey: '2-4', grade: 2, seq: 4 },
  { legacyId: '53', lessonKey: '2-5', grade: 2, seq: 5 },
  { legacyId: '55', lessonKey: '2-6', grade: 2, seq: 6 },
]

function routeFor({ grade, seq }) {
  return `/math/ny/g${grade}/${seq}`
}

function migrateDataFileContent(content, legacyId, lessonKey) {
  let out = content
  // Order: longer legacy ids first within file is single id so ok
  out = out.replaceAll(`${legacyId}__SUMMARY`, `${lessonKey}__SUMMARY`)
  out = out.replaceAll(`'${legacyId}-`, `'${lessonKey}-`)
  out = out.replaceAll(`"${legacyId}-`, `"${lessonKey}-`)
  out = out.replaceAll(`\`${legacyId}-`, `\`${lessonKey}-`)
  // Storage paths in strings like figures/49/ or summaries/49/
  out = out.replaceAll(`/${legacyId}/`, `/${lessonKey}/`)
  out = out.replaceAll(`/${legacyId}.`, `/${lessonKey}.`)
  return out
}

function migratePathsInContent(content) {
  let out = content
  // Sort by legacyId length desc to avoid partial matches (e.g. 5 vs 55)
  const sorted = [...LESSON_MAP].sort((a, b) => b.legacyId.length - a.legacyId.length)
  for (const entry of sorted) {
    const route = routeFor(entry)
    const legacyRoute = `/math/ny/${entry.legacyId}`
    out = out.replaceAll(legacyRoute, route)
  }
  return out
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walkFiles(p, acc)
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      acc.push(p)
    }
  }
  return acc
}

let dataFiles = 0
for (const { legacyId, lessonKey } of LESSON_MAP) {
  for (const ext of ['.ts', '.tsx']) {
    const path = resolve(mathSrc, `utils/lesson${legacyId}-data${ext}`)
    if (!existsSync(path)) continue
    const before = readFileSync(path, 'utf8')
    const after = migrateDataFileContent(before, legacyId, lessonKey)
    if (after !== before) {
      writeFileSync(path, after)
      dataFiles++
      console.log(`data: lesson${legacyId}-data${ext}`)
    }
  }
}

const componentDirs = [
  resolve(mathSrc, 'components'),
  resolve(root, 'apps/web/src/app/math'),
]
let pathFiles = 0
let lessonIdFiles = 0
for (const dir of componentDirs) {
  if (!existsSync(dir)) continue
  for (const file of walkFiles(dir)) {
    const before = readFileSync(file, 'utf8')
    if (!before.includes('/math/ny/')) continue
    const after = migratePathsInContent(before)
    if (after !== before) {
      writeFileSync(file, after)
      pathFiles++
    }
  }
}

for (const { legacyId, lessonKey } of LESSON_MAP) {
  const dirs = [resolve(mathSrc, 'components'), resolve(root, 'apps/web/src/app/math')]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const file of walkFiles(dir)) {
      const before = readFileSync(file, 'utf8')
      const needle = `lessonId="${legacyId}"`
      if (!before.includes(needle)) continue
      const after = before.replaceAll(needle, `lessonId="${lessonKey}"`)
      writeFileSync(file, after)
      lessonIdFiles++
    }
  }
}

console.log(`\nDone: ${dataFiles} data files, ${pathFiles} path files, ${lessonIdFiles} lessonId props updated`)
