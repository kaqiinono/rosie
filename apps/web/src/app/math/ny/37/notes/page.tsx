'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson37-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/37"
      lessonId="37"
      problems={PROBLEMS}
    />
  )
}
