'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson38-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/38"
      lessonId="38"
      problems={PROBLEMS}
    />
  )
}
