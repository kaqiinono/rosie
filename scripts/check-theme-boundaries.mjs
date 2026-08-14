#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE_ROOTS = ['apps', 'packages']
const SOURCE_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.ts', '.tsx'])
const INTENTIONAL_DARK_SCOPES = new Set([
  'apps/web/src/app/calc/layout.tsx',
  'apps/web/src/app/admin/calc/layout.tsx',
  'packages/flipbook/src/flipbook.css',
])

const SYSTEM_DARK_PATTERN = /prefers-color-scheme\s*:\s*dark|matchMedia\([^\n]*prefers-color-scheme/i
const NATIVE_DARK_PATTERN = /color-scheme\s*:\s*dark|colorScheme\s*:\s*['"]dark['"]/i

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)))
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path)
  }
  return files
}

const violations = []
for (const sourceRoot of SOURCE_ROOTS) {
  for (const file of await sourceFiles(resolve(ROOT, sourceRoot))) {
    const repoPath = relative(ROOT, file)
    const source = await readFile(file, 'utf8')
    if (SYSTEM_DARK_PATTERN.test(source)) {
      violations.push(`${repoPath}: do not follow system dark mode; Rosie uses a fixed light theme`)
    }
    if (NATIVE_DARK_PATTERN.test(source) && !INTENTIONAL_DARK_SCOPES.has(repoPath)) {
      violations.push(`${repoPath}: dark color-scheme must be scoped and allowlisted`)
    }
  }
}

if (violations.length > 0) {
  console.error(`Theme boundary check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Theme boundary check passed.')
}
