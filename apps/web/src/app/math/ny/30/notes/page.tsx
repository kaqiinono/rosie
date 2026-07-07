'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson30-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/30"
      lessonId="30"
      problems={PROBLEMS}
    />
  )
}
