'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson44-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/44"
      lessonId="44"
      problems={PROBLEMS}
    />
  )
}
