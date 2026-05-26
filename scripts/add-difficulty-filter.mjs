/**
 * Adds difficulty filter to all FilterPanel + alltest pages.
 * Run: node scripts/add-difficulty-filter.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(import.meta.dirname, '..')

const DIFFICULTY_FILTER_BLOCK = `
        <DifficultyFilterRow
          selected={filters.difficulty}
          onToggle={level => onToggleFilter('difficulty', String(level))}
          btnBase={btnBase}
          btnOn={btnOn}
          btnOff={btnOff}
          accentClass="ACCENT_PLACEHOLDER"
        />
`

function patchFilterPanel(filePath) {
  let c = fs.readFileSync(filePath, 'utf8')
  if (c.includes('DifficultyFilterRow')) return false

  // accent from btnOff text-*-700 pattern
  const accentM = c.match(/btnOff = '[^']*text-([\w-]+)-700/)
  const accent = accentM ? `text-${accentM[1]}-700` : 'text-text-secondary'

  if (!c.includes("from '@/utils/difficulty'")) {
    c = c.replace(
      /import ProblemDetail from '\.\/ProblemDetail'/,
      `import type { ProblemDifficulty } from '@/utils/difficulty'\nimport DifficultyFilterRow from '@/components/math/shared/DifficultyFilterRow'\nimport ProblemDetail from './ProblemDetail'`,
    )
  }

  c = c.replace(
    /interface Filters \{([^}]+)\}/s,
    (m, body) => {
      if (body.includes('difficulty')) return m
      return `interface Filters {${body.replace(
        /mastery: MasteryFilter\n/,
        'mastery: MasteryFilter\n  difficulty: Set<ProblemDifficulty>\n',
      )}}`
    },
  )

  c = c.replace(
    /onToggleFilter: \(axis: 'source' \| 'type', value: string\) => void/,
    "onToggleFilter: (axis: 'source' | 'type' | 'difficulty', value: string) => void",
  )

  c = c.replace(
    /filters\.type\.has\(p\.tag\) &&\s*\n\s*matchesMastery/,
    'filters.type.has(p.tag) &&\n      filters.difficulty.has(p.difficulty) &&\n      matchesMastery',
  )

  const block = DIFFICULTY_FILTER_BLOCK.replace('ACCENT_PLACEHOLDER', accent)
  c = c.replace(
    /(<div className="mb-2">\s*\n\s*<div className="mb-1\.5 text-\[11px\] font-bold[^🎯]*🎯 掌握度)/,
    `${block}\n$1`,
  )

  fs.writeFileSync(filePath, c)
  return true
}

function patchAlltest(filePath) {
  let c = fs.readFileSync(filePath, 'utf8')
  if (c.includes('difficulty: new Set')) return false

  if (!c.includes("import type { ProblemDifficulty }")) {
    c = c.replace(
      /import FilterPanel/,
      `import type { ProblemDifficulty } from '@/utils/difficulty'\nimport FilterPanel`,
    )
  }

  c = c.replace(
    /mastery: 'all' as MasteryFilter,\n  \}\)\)/,
    "mastery: 'all' as MasteryFilter,\n    difficulty: new Set<ProblemDifficulty>([1, 2, 3, 4, 5]),\n  }))",
  )

  c = c.replace(
    /const toggleFilter = \(axis: 'source' \| 'type', value: string\) => \{/,
    `const toggleFilter = (axis: 'source' | 'type' | 'difficulty', value: string) => {
    if (axis === 'difficulty') {
      const level = Number(value) as ProblemDifficulty
      setFilters(f => {
        const next = new Set(f.difficulty)
        if (next.has(level)) next.delete(level)
        else next.add(level)
        return { ...f, difficulty: next }
      })
      return
    }`,
  )

  fs.writeFileSync(filePath, c)
  return true
}

let fp = 0
let at = 0
for (const dir of fs.readdirSync(path.join(ROOT, 'src/components/math'))) {
  if (!dir.startsWith('lesson')) continue
  const fpPath = path.join(ROOT, 'src/components/math', dir, 'FilterPanel.tsx')
  if (fs.existsSync(fpPath) && patchFilterPanel(fpPath)) {
    console.log('FilterPanel', dir)
    fp++
  }
}

for (const dir of fs.readdirSync(path.join(ROOT, 'src/app/math/ny'))) {
  const atPath = path.join(ROOT, 'src/app/math/ny', dir, 'alltest/page.tsx')
  if (fs.existsSync(atPath) && patchAlltest(atPath)) {
    console.log('alltest', dir)
    at++
  }
}

console.log(`Patched ${fp} FilterPanels, ${at} alltest pages`)
