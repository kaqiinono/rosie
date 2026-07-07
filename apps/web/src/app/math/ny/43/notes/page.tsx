'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson43-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/43"
      lessonId="43"
      problems={PROBLEMS}
    />
  )
}
