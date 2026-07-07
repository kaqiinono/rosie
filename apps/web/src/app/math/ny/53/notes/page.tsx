'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson53-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/53"
      lessonId="53"
      problems={PROBLEMS}
    />
  )
}
