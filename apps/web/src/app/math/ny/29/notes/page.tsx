'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/29"
      lessonId="29"
      problems={PROBLEMS}
    />
  )
}
