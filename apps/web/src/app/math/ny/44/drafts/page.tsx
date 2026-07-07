'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson44-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/44"
      lessonId="44"
      problems={PROBLEMS}
    />
  )
}
