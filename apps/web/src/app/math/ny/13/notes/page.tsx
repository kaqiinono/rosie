'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson13-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/13"
      lessonId="13"
      problems={PROBLEMS}
    />
  )
}
