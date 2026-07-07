'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson52-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/52"
      lessonId="52"
      problems={PROBLEMS}
    />
  )
}
