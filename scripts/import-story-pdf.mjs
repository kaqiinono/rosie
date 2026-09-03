#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const input = arg('--input')
const output = arg('--output')
const seriesTitle = arg('--series')
const volumeTitle = arg('--volume')
const author = arg('--author')
const seriesSlug = arg('--series-slug')
const volumeSlug = arg('--volume-slug')
const vocabJson = arg('--vocab-json')
const auditOutput = arg('--audit-output')

if (!input || !output || !seriesTitle || !volumeTitle || !author || !seriesSlug || !volumeSlug) {
  console.error(
    'Usage: node scripts/import-story-pdf.mjs --input book.pdf --output story.ts ' +
      '--series "Series" --series-slug series --volume "Volume" --volume-slug volume --author "Author"',
  )
  process.exit(1)
}

const pdfPath = resolve(input)
const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
})

// Front matter often repeats the table-of-contents headings. Start at the first
// numbered heading after the copyright page when one is present.
const copyrightAt = text.search(/Text copyright/i)
const body = text.slice(copyrightAt >= 0 ? copyrightAt : 0).replace(/\f/g, '\n\n')
const headingRe = /^\s*(\d{1,3})\.\s+([^\n]+?)\s*$/gm
const headings = [...body.matchAll(headingRe)]
if (headings.length === 0) throw new Error('No numbered chapter headings found')

function cleanParagraph(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([“‘])\s+/g, '$1')
    .replace(/\s+([”’])/g, '$1')
    .trim()
}

const chapters = headings.map((heading, index) => {
  const start = (heading.index ?? 0) + heading[0].length
  const end = headings[index + 1]?.index ?? body.length
  const raw = body.slice(start, end)
  const paragraphs = raw
    .split(/\n\s*\n+/)
    .map(cleanParagraph)
    .filter(Boolean)
    .filter((p) => !/^[-–—]+$/.test(p))
    .filter((p) => !/^Are you a fan of/i.test(p) && !/^at www\./i.test(p))
  const number = Number(heading[1])
  return {
    key: `ch${String(number).padStart(2, '0')}`,
    number,
    title: cleanParagraph(heading[2]),
    paragraphs,
    glossary: [],
  }
})

const generated =
  `// Generated from ${basename(pdfPath)} by scripts/import-story-pdf.mjs.\n` +
  `// Review OCR cleanup and glossary entries before committing.\n` +
  `import type { StorySeries } from './story-types'\n\n` +
  `export const magicTreeHouse: StorySeries = ${JSON.stringify(
    {
      slug: seriesSlug,
      title: seriesTitle,
      author,
      description:
        'Jack and Annie travel through time and discover extraordinary worlds in a magical tree house.',
      volumes: [
        {
          slug: volumeSlug,
          number: 1,
          title: volumeTitle,
          description:
            'Jack and Annie travel to the age of dinosaurs on their first magic tree house adventure.',
          chapters,
        },
      ],
    },
    null,
    2,
  )}\n`

writeFileSync(resolve(output), generated)
console.log(`Wrote ${chapters.length} chapters to ${resolve(output)}`)

if (vocabJson && auditOutput) {
  const rows = JSON.parse(readFileSync(resolve(vocabJson), 'utf8'))
  const known = new Set(rows.map((row) => String(row.word).toLowerCase()))
  const unmatched = new Map()
  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const match of paragraph.toLowerCase().matchAll(/[a-z]+(?:[-'][a-z]+)*/g)) {
        const surface = match[0]
        const candidates = [
          surface,
          surface.replace(/ies$/, 'y'),
          surface.replace(/ied$/, 'y'),
          surface.replace(/ing$/, ''),
          surface.replace(/ed$/, ''),
          surface.replace(/es$/, ''),
          surface.replace(/s$/, ''),
        ]
        if (candidates.some((candidate) => known.has(candidate))) continue
        const current = unmatched.get(surface) ?? { word: surface, count: 0, chapters: new Set() }
        current.count += 1
        current.chapters.add(chapter.key)
        unmatched.set(surface, current)
      }
    }
  }
  const report = [...unmatched.values()]
    .map((entry) => ({ ...entry, chapters: [...entry.chapters] }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
  writeFileSync(resolve(auditOutput), JSON.stringify(report, null, 2))
  console.log(`Wrote ${report.length} unmatched candidates to ${resolve(auditOutput)}`)
}
