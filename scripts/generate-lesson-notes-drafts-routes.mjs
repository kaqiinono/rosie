#!/usr/bin/env node
/**
 * Generate notes + drafts route shells from existing mistakes/page.tsx files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nyDir = path.join(root, 'apps/web/src/app/math/ny')

for (const lessonId of fs.readdirSync(nyDir)) {
  const mistakesPage = path.join(nyDir, lessonId, 'mistakes', 'page.tsx')
  if (!fs.existsSync(mistakesPage)) continue

  const src = fs.readFileSync(mistakesPage, 'utf8')
  const baseMatch = src.match(/basePath="(\/math\/ny\/[^"]+)"/)
  const dataMatch = src.match(/from '@rosie\/math\/utils\/(lesson[^']+-data)'/)
  if (!baseMatch || !dataMatch) {
    console.warn(`skip ${lessonId}: could not parse mistakes page`)
    continue
  }

  const basePath = baseMatch[1]
  const dataModule = dataMatch[1]

  const notesPage = `'use client'

import { PROBLEMS } from '@rosie/math/utils/${dataModule}'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="${basePath}"
      lessonId="${lessonId}"
      problems={PROBLEMS}
    />
  )
}
`

  const draftsPage = `'use client'

import { PROBLEMS } from '@rosie/math/utils/${dataModule}'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="${basePath}"
      lessonId="${lessonId}"
      problems={PROBLEMS}
    />
  )
}
`

  const notesDir = path.join(nyDir, lessonId, 'notes')
  const draftsDir = path.join(nyDir, lessonId, 'drafts')
  fs.mkdirSync(notesDir, { recursive: true })
  fs.mkdirSync(draftsDir, { recursive: true })
  fs.writeFileSync(path.join(notesDir, 'page.tsx'), notesPage)
  fs.writeFileSync(path.join(draftsDir, 'page.tsx'), draftsPage)
  console.log(`generated ${lessonId}/notes + drafts`)
}

// Remove LessonNotes from HomePage files
const componentsDir = path.join(root, 'packages/math/src/components')
for (const name of fs.readdirSync(componentsDir)) {
  if (!name.startsWith('lesson')) continue
  const homePage = path.join(componentsDir, name, 'HomePage.tsx')
  if (!fs.existsSync(homePage)) continue
  let home = fs.readFileSync(homePage, 'utf8')
  if (!home.includes('LessonNotes')) continue

  home = home.replace(/\nimport LessonNotes from '@rosie\/math\/components\/shared\/LessonNotes'\n/, '\n')
  home = home.replace(/\n\s*<LessonNotes[^/]*\/>\n/, '\n')
  fs.writeFileSync(homePage, home)
  console.log(`cleaned ${name}/HomePage.tsx`)
}
