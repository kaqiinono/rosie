'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson39-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/39"
      lessonId="39"
      problems={PROBLEMS}
    />
  )
}
