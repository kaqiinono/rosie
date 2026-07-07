'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson40-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/40"
      lessonId="40"
      problems={PROBLEMS}
    />
  )
}
