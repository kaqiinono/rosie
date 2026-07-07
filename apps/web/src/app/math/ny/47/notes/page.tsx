'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson47-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/47"
      lessonId="47"
      problems={PROBLEMS}
    />
  )
}
