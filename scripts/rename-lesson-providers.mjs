#!/usr/bin/env node
/**
 * Rename LessonNNProvider to G{grade}Lesson{seq}Provider under components/lesson/gX/lessonY/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lessonRoot = path.join(root, 'packages/math/src/components/lesson')
const registryPath = path.join(root, 'packages/math/src/utils/lesson-module-registry.ts')

/** @type {{ lessonKey: string, grade: number, seq: number }[]} */
const LESSONS = [
  { lessonKey: '1-12', grade: 1, seq: 12 },
  { lessonKey: '1-13', grade: 1, seq: 13 },
  { lessonKey: '1-15', grade: 1, seq: 15 },
  { lessonKey: '1-18', grade: 1, seq: 18 },
  { lessonKey: '1-23', grade: 1, seq: 23 },
  { lessonKey: '1-29', grade: 1, seq: 29 },
  { lessonKey: '1-30', grade: 1, seq: 30 },
  { lessonKey: '1-34', grade: 1, seq: 34 },
  { lessonKey: '1-35', grade: 1, seq: 35 },
  { lessonKey: '1-36', grade: 1, seq: 36 },
  { lessonKey: '1-37', grade: 1, seq: 37 },
  { lessonKey: '1-38', grade: 1, seq: 38 },
  { lessonKey: '1-39', grade: 1, seq: 39 },
  { lessonKey: '1-40', grade: 1, seq: 40 },
  { lessonKey: '1-41', grade: 1, seq: 41 },
  { lessonKey: '1-42', grade: 1, seq: 42 },
  { lessonKey: '1-43', grade: 1, seq: 43 },
  { lessonKey: '1-44', grade: 1, seq: 44 },
  { lessonKey: '1-46', grade: 1, seq: 46 },
  { lessonKey: '1-47', grade: 1, seq: 47 },
  { lessonKey: '2-1', grade: 2, seq: 1 },
  { lessonKey: '2-2', grade: 2, seq: 2 },
  { lessonKey: '2-3', grade: 2, seq: 3 },
  { lessonKey: '2-4', grade: 2, seq: 4 },
  { lessonKey: '2-5', grade: 2, seq: 5 },
  { lessonKey: '2-6', grade: 2, seq: 6 },
  { lessonKey: '2-7', grade: 2, seq: 7 },
]

function providerNames(grade, seq) {
  const base = `G${grade}Lesson${seq}`
  return {
    base,
    file: `${base}Provider.tsx`,
    hook: `use${base}`,
    provider: `${base}Provider`,
  }
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, files)
    else if (/\.(tsx?|jsx?)$/.test(name)) files.push(p)
  }
  return files
}

function replaceInFile(filePath, replacements) {
  let text = fs.readFileSync(filePath, 'utf8')
  let changed = false
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.split(from).join(to)
      changed = true
    }
  }
  if (changed) fs.writeFileSync(filePath, text)
  return changed
}

const legacyToNew = new Map()

for (const { grade, seq } of LESSONS) {
  const dir = path.join(lessonRoot, `g${grade}`, `lesson${seq}`)
  if (!fs.existsSync(dir)) {
    console.warn('skip missing dir', dir)
    continue
  }
  const { base, file, hook, provider } = providerNames(grade, seq)
  const oldProviders = fs.readdirSync(dir).filter((f) => /Lesson\d+Provider\.tsx$/.test(f))
  if (oldProviders.length === 0) {
    console.warn('no legacy provider in', dir)
    continue
  }
  if (oldProviders.length > 1) {
    console.warn('multiple providers in', dir, oldProviders)
  }
  const oldFile = oldProviders[0]
  const oldPath = path.join(dir, oldFile)
  const newPath = path.join(dir, file)

  const oldMatch = oldFile.match(/Lesson(\d+)Provider/)
  const oldNum = oldMatch?.[1] ?? '?'
  const oldHook = `useLesson${oldNum}`
  const oldProvider = `Lesson${oldNum}Provider`

  legacyToNew.set(oldHook, hook)
  legacyToNew.set(oldProvider, provider)
  legacyToNew.set(`createLessonProvider('${oldProvider}')`, `createLessonProvider('${base}')`)
  legacyToNew.set(`./${oldFile.replace('.tsx', '')}`, `./${base}Provider`)
  legacyToNew.set(`'${oldFile}'`, `'${file}'`)

  const content = `'use client'

import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('${base}')

export default Provider
export { useLessonContext as ${hook} }
`
  fs.writeFileSync(newPath, content)
  if (oldPath !== newPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
  console.log('provider', `${oldFile} → ${file}`, dir)
}

// Replace in all lesson/g* files
const lessonFiles = walk(lessonRoot)
for (const file of lessonFiles) {
  const reps = [...legacyToNew.entries()].sort((a, b) => b[0].length - a[0].length)
  replaceInFile(file, reps)
}

// Update module registry imports
let reg = fs.readFileSync(registryPath, 'utf8')
for (const [from, to] of [...legacyToNew.entries()].sort((a, b) => b[0].length - a[0].length)) {
  reg = reg.split(from).join(to)
}
// Fix import paths LessonNNProvider -> G*Provider
reg = reg.replace(
  /Lesson\d+Provider/g,
  (m) => {
    // already replaced in most cases; leftover fallback
    return m
  },
)
for (const { grade, seq } of LESSONS) {
  const { file, hook, provider } = providerNames(grade, seq)
  const importPath = `@rosie/math/components/lesson/g${grade}/lesson${seq}/${provider}`
  reg = reg.replace(
    new RegExp(`@rosie/math/components/lesson/g${grade}/lesson${seq}/Lesson\\d+Provider`, 'g'),
    importPath,
  )
  // default import alias: Provider49 -> keep or use G2Lesson1Provider - normalize useLesson in registry entries
}
fs.writeFileSync(registryPath, reg)

console.log('done', legacyToNew.size, 'symbol mappings')
