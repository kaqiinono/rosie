#!/usr/bin/env node
/**
 * One-shot cleanup: canonical math routes are /math/ny/{grade}/{seq} only.
 * - Strips g-prefix from paths
 * - Rewrites courses-data RAW hrefs via lesson registry
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const LESSONS = [
  ['1-12', 1, 12, '12'], ['1-13', 1, 13, '13'], ['1-15', 1, 15, '15'],
  ['1-18', 1, 18, '18'], ['1-23', 1, 23, '23'], ['1-29', 1, 29, '29'],
  ['1-30', 1, 30, '30'], ['1-34', 1, 34, '34'], ['1-35', 1, 35, '35'],
  ['1-36', 1, 36, '36'], ['1-37', 1, 37, '37'], ['1-38', 1, 38, '38'],
  ['1-39', 1, 39, '39'], ['1-40', 1, 40, '40'], ['1-41', 1, 41, '41'],
  ['1-42', 1, 42, '42'], ['1-43', 1, 43, '43'], ['1-44', 1, 44, '44'],
  ['1-46', 1, 46, '46'], ['1-47', 1, 47, '47'],
  ['2-1', 2, 1, '49'], ['2-2', 2, 2, '50'], ['2-3', 2, 3, '51'],
  ['2-4', 2, 4, '52'], ['2-5', 2, 5, '53'], ['2-6', 2, 6, '55'],
]

const legacyToRoute = new Map(
  LESSONS.map(([, grade, seq, legacyId]) => [legacyId, `/math/ny/${grade}/${seq}`]),
)

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|md|mjs)$/.test(name)) out.push(p)
  }
  return out
}

let fileCount = 0
for (const file of walk(root)) {
  let src = fs.readFileSync(file, 'utf8')
  const orig = src

  // /math/ny/2/4 → /math/ny/2/4
  src = src.replace(/\/math\/ny\/g(\d+)\//g, '/math/ny/$1/')
  src = src.replace(/\/math\/ny\/g(\d+)(['"`\s])/g, '/math/ny/$1$2')

  // legacy single-segment lesson hrefs in source
  for (const [legacyId, route] of legacyToRoute) {
    const re = new RegExp(`/math/ny/${legacyId}(?=/|['"\`\\s]|$)`, 'g')
    src = src.replace(re, route)
  }

  if (src !== orig) {
    fs.writeFileSync(file, src)
    fileCount++
  }
}

console.log(`Updated ${fileCount} files`)
