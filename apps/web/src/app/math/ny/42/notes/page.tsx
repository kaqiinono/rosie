'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson42-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/42"
      lessonId="42"
      problems={PROBLEMS}
    />
  )
}
