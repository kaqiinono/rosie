#!/usr/bin/env node
/** Normalize sea-data PROBLEMS/PT/TS import aliases to G{grade}Lesson{seq}* */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages/math/src/utils/sea-data.ts',
)

const LEGACY = {
  12: [1, 12], 13: [1, 13], 15: [1, 15], 18: [1, 18], 23: [1, 23], 29: [1, 29],
  30: [1, 30], 34: [1, 34], 35: [1, 35], 36: [1, 36], 37: [1, 37], 38: [1, 38],
  39: [1, 39], 40: [1, 40], 41: [1, 41], 42: [1, 42], 43: [1, 43], 44: [1, 44],
  46: [1, 46], 47: [1, 47], 49: [2, 1], 50: [2, 2], 51: [2, 3], 52: [2, 4],
  53: [2, 5], 55: [2, 6], 56: [2, 7],
}

function sym(g, s, suffix) {
  return `G${g}Lesson${s}${suffix}`
}

let text = fs.readFileSync(file, 'utf8')
for (const [n, [g, s]] of Object.entries(LEGACY)) {
  text = text.replaceAll(`PROBLEMS as PROBLEMS${n}`, `PROBLEMS as ${sym(g, s, 'PROBLEMS')}`)
  text = text.replaceAll(`PROBLEM_TYPES as PT${n}`, `PROBLEM_TYPES as ${sym(g, s, 'PT')}`)
  text = text.replaceAll(`TAG_STYLE as TS${n}`, `TAG_STYLE as ${sym(g, s, 'TS')}`)
  text = text.replaceAll(`PROBLEMS${n}`, sym(g, s, 'PROBLEMS'))
  text = text.replaceAll(`PT${n}`, sym(g, s, 'PT'))
  text = text.replaceAll(`TS${n}`, sym(g, s, 'TS'))
}
fs.writeFileSync(file, text)
console.log('sea-data aliases normalized')
