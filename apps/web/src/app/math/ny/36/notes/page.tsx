'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson36-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/36"
      lessonId="36"
      problems={PROBLEMS}
    />
  )
}
