#!/usr/bin/env node
/**
 * Point legacy @rosie/math/components/lessonNN imports to lesson/g{grade}/lesson{seq}
 * and LessonNNProvider to G{grade}Lesson{seq}Provider in apps/web.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const webMath = path.join(root, 'apps/web/src/app/math')

/** legacy folder number -> g{grade}/lesson{seq} */
const LEGACY_FOLDER = {
  12: 'g1/lesson12', 13: 'g1/lesson13', 15: 'g1/lesson15', 18: 'g1/lesson18',
  23: 'g1/lesson23', 29: 'g1/lesson29', 30: 'g1/lesson30', 34: 'g1/lesson34',
  35: 'g1/lesson35', 36: 'g1/lesson36', 37: 'g1/lesson37', 38: 'g1/lesson38',
  39: 'g1/lesson39', 40: 'g1/lesson40', 41: 'g1/lesson41', 42: 'g1/lesson42',
  43: 'g1/lesson43', 44: 'g1/lesson44', 46: 'g1/lesson46', 47: 'g1/lesson47',
  49: 'g2/lesson1', 50: 'g2/lesson2', 51: 'g2/lesson3', 52: 'g2/lesson4',
  53: 'g2/lesson5', 55: 'g2/lesson6', 56: 'g2/lesson7',
}

/** legacy N -> { grade, seq } for provider symbols */
const LEGACY_PROVIDER = {
  12: [1, 12], 13: [1, 13], 15: [1, 15], 18: [1, 18], 23: [1, 23], 29: [1, 29],
  30: [1, 30], 34: [1, 34], 35: [1, 35], 36: [1, 36], 37: [1, 37], 38: [1, 38],
  39: [1, 39], 40: [1, 40], 41: [1, 41], 42: [1, 42], 43: [1, 43], 44: [1, 44],
  46: [1, 46], 47: [1, 47], 49: [2, 1], 50: [2, 2], 51: [2, 3], 52: [2, 4],
  53: [2, 5], 55: [2, 6], 56: [2, 7],
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

function providerSym(n, kind) {
  const [g, s] = LEGACY_PROVIDER[n]
  return kind === 'provider'
    ? `G${g}Lesson${s}Provider`
    : `useG${g}Lesson${s}`
}

let changed = 0
for (const file of walk(webMath)) {
  let text = fs.readFileSync(file, 'utf8')
  let orig = text
  for (const [n, rel] of Object.entries(LEGACY_FOLDER)) {
    text = text.replaceAll(
      `@rosie/math/components/lesson${n}/`,
      `@rosie/math/components/lesson/${rel}/`,
    )
    text = text.replaceAll(`Lesson${n}Provider`, providerSym(Number(n), 'provider'))
    text = text.replaceAll(`useLesson${n}`, providerSym(Number(n), 'hook'))
  }
  if (text !== orig) {
    fs.writeFileSync(file, text)
    changed++
  }
}

console.log('updated', changed, 'files under apps/web/src/app/math')
