#!/usr/bin/env node
/** Remove duplicate root lesson{NN} component trees (canonical: lesson/g{grade}/lesson{seq}/). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const components = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages/math/src/components',
)

const orphans = [
  path.join(components, 'lesson/g2/lesson2/lesson49'),
]

let removed = 0
for (const name of fs.readdirSync(components)) {
  if (/^lesson\d+$/.test(name)) {
    fs.rmSync(path.join(components, name), { recursive: true, force: true })
    removed++
  }
}
for (const p of orphans) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true })
    removed++
  }
}

console.log('removed', removed, 'legacy lesson directories')
