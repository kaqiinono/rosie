#!/usr/bin/env node
// Guards the monorepo's "no cyclic package dependencies" invariant (CLAUDE.md DAG).
// Builds a package-level graph from `@rosie/*` import specifiers found in each
// packages/*/src and fails if any cycle exists. Intentionally package-level (not
// file-level) to avoid the noise of benign intra-package import cycles — it exists
// to catch the regression risk of splitting @rosie/math into layered packages.
//
// Usage: node scripts/check-package-cycles.mjs   (exit 0 = acyclic, 1 = cycle found)

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKGS_DIR = join(ROOT, 'packages')

// Map @rosie/<name> -> package dir, from each package.json "name".
const nameToDir = new Map()
for (const entry of readdirSync(PKGS_DIR)) {
  const pkgJson = join(PKGS_DIR, entry, 'package.json')
  if (!existsSync(pkgJson)) continue
  const { name } = JSON.parse(readFileSync(pkgJson, 'utf8'))
  if (name) nameToDir.set(name, join(PKGS_DIR, entry))
}

const SRC_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx'])
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (SRC_EXT.has(extname(p))) out.push(p)
  }
  return out
}

// import/require specifier matcher, captures the @rosie/<seg> package segment.
const SPEC_RE = /(?:import|export)[^'"]*?from\s*['"]@rosie\/([a-z0-9-]+)|(?:require|import)\(\s*['"]@rosie\/([a-z0-9-]+)/g

const edges = new Map() // pkgName -> Set(depPkgName)
for (const [name, dir] of nameToDir) {
  const deps = new Set()
  const srcDir = join(dir, 'src')
  if (!existsSync(srcDir)) continue
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(SPEC_RE)) {
      const seg = m[1] ?? m[2]
      const depName = `@rosie/${seg}`
      if (depName !== name && nameToDir.has(depName)) deps.add(depName)
    }
  }
  edges.set(name, deps)
}

// DFS cycle detection; report the first cycle found.
const WHITE = 0, GRAY = 1, BLACK = 2
const color = new Map([...edges.keys()].map((k) => [k, WHITE]))
const stack = []
let cycle = null

function dfs(node) {
  color.set(node, GRAY)
  stack.push(node)
  for (const dep of edges.get(node) ?? []) {
    if (cycle) return
    const c = color.get(dep)
    if (c === GRAY) {
      cycle = stack.slice(stack.indexOf(dep)).concat(dep)
      return
    }
    if (c === WHITE) dfs(dep)
  }
  stack.pop()
  color.set(node, BLACK)
}

for (const node of edges.keys()) {
  if (cycle) break
  if (color.get(node) === WHITE) dfs(node)
}

if (cycle) {
  console.error('✗ package dependency cycle detected:\n  ' + cycle.join(' → '))
  process.exit(1)
}

const pkgList = [...edges.keys()].sort().join(', ')
console.log(`✓ no package dependency cycles across ${edges.size} packages (${pkgList})`)
