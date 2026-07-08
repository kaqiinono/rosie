#!/usr/bin/env node
/** Normalize lesson-module-registry import aliases to G{grade}Lesson{seq}* */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const registryPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages/math/src/utils/lesson-module-registry.ts',
)

/** legacy global id used in old aliases */
const LEGACY = {
  '1-12': 12, '1-13': 13, '1-15': 15, '1-18': 18, '1-23': 23, '1-29': 29, '1-30': 30,
  '1-34': 34, '1-35': 35, '1-36': 36, '1-37': 37, '1-38': 38, '1-39': 39, '1-40': 40,
  '1-41': 41, '1-42': 42, '1-43': 43, '1-44': 44, '1-46': 46, '1-47': 47,
  '2-1': 49, '2-2': 50, '2-3': 51, '2-4': 52, '2-5': 53, '2-6': 55, '2-7': 56,
}

const LESSONS = [
  { lessonKey: '1-12', grade: 1, seq: 12 }, { lessonKey: '1-13', grade: 1, seq: 13 },
  { lessonKey: '1-15', grade: 1, seq: 15 }, { lessonKey: '1-18', grade: 1, seq: 18 },
  { lessonKey: '1-23', grade: 1, seq: 23 }, { lessonKey: '1-29', grade: 1, seq: 29 },
  { lessonKey: '1-30', grade: 1, seq: 30 }, { lessonKey: '1-34', grade: 1, seq: 34 },
  { lessonKey: '1-35', grade: 1, seq: 35 }, { lessonKey: '1-36', grade: 1, seq: 36 },
  { lessonKey: '1-37', grade: 1, seq: 37 }, { lessonKey: '1-38', grade: 1, seq: 38 },
  { lessonKey: '1-39', grade: 1, seq: 39 }, { lessonKey: '1-40', grade: 1, seq: 40 },
  { lessonKey: '1-41', grade: 1, seq: 41 }, { lessonKey: '1-42', grade: 1, seq: 42 },
  { lessonKey: '1-43', grade: 1, seq: 43 }, { lessonKey: '1-44', grade: 1, seq: 44 },
  { lessonKey: '1-46', grade: 1, seq: 46 }, { lessonKey: '1-47', grade: 1, seq: 47 },
  { lessonKey: '2-1', grade: 2, seq: 1 }, { lessonKey: '2-2', grade: 2, seq: 2 },
  { lessonKey: '2-3', grade: 2, seq: 3 }, { lessonKey: '2-4', grade: 2, seq: 4 },
  { lessonKey: '2-5', grade: 2, seq: 5 }, { lessonKey: '2-6', grade: 2, seq: 6 },
  { lessonKey: '2-7', grade: 2, seq: 7 },
]

function sym(grade, seq, suffix) {
  return `G${grade}Lesson${seq}${suffix}`
}

let text = fs.readFileSync(registryPath, 'utf8')

for (const { lessonKey, grade, seq } of LESSONS) {
  const n = LEGACY[lessonKey]
  const p = sym(grade, seq, '')
  const replacements = [
    [`Provider${n},`, `${sym(grade, seq, 'Provider')},`],
    [`Provider${n}`, sym(grade, seq, 'Provider')],
    [`HomePage${n}`, sym(grade, seq, 'HomePage')],
    [`AppHeader${n}`, sym(grade, seq, 'AppHeader')],
    [`Sidebar${n}`, sym(grade, seq, 'Sidebar')],
    [`BottomNav${n}`, sym(grade, seq, 'BottomNav')],
    [`FilterPanel${n}`, sym(grade, seq, 'FilterPanel')],
    [`ProblemList${n}`, sym(grade, seq, 'ProblemList')],
    [`ProblemDetail${n}`, sym(grade, seq, 'ProblemDetail')],
    [`PROBLEMS as P${n}`, `PROBLEMS as ${sym(grade, seq, 'PROBLEMS')}`],
    [`TAG_STYLE as TS${n}`, `TAG_STYLE as ${sym(grade, seq, 'TAG_STYLE')}`],
    [`P${n},`, `${sym(grade, seq, 'PROBLEMS')},`],
    [`TS${n},`, `${sym(grade, seq, 'TAG_STYLE')},`],
  ]
  for (const [from, to] of replacements) {
    text = text.split(from).join(to)
  }
}

fs.writeFileSync(registryPath, text)
console.log('normalized lesson-module-registry aliases')
