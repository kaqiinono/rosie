'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson18-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/18"
      lessonId="18"
      problems={PROBLEMS}
    />
  )
}
