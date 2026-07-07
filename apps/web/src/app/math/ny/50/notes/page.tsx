'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson50-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/50"
      lessonId="50"
      problems={PROBLEMS}
    />
  )
}
