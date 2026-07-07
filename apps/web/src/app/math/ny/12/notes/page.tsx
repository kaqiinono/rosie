'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson12-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/12"
      lessonId="12"
      problems={PROBLEMS}
    />
  )
}
