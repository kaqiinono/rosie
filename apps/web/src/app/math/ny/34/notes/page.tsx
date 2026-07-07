'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson34-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/34"
      lessonId="34"
      problems={PROBLEMS}
    />
  )
}
