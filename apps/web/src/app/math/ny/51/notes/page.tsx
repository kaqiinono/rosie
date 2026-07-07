'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson51-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/51"
      lessonId="51"
      problems={PROBLEMS}
    />
  )
}
