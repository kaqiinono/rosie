'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson49-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/49"
      lessonId="49"
      problems={PROBLEMS}
    />
  )
}
