'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson41-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/41"
      lessonId="41"
      problems={PROBLEMS}
    />
  )
}
