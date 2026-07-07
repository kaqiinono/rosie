'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson23-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/23"
      lessonId="23"
      problems={PROBLEMS}
    />
  )
}
