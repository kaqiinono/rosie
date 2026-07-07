'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson15-data'
import LessonNotesPage from '@rosie/math/components/shared/LessonNotesPage'

export default function NotesPage() {
  return (
    <LessonNotesPage
      basePath="/math/ny/15"
      lessonId="15"
      problems={PROBLEMS}
    />
  )
}
