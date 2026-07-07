'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson46-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/46"
      lessonId="46"
      problems={PROBLEMS}
    />
  )
}
