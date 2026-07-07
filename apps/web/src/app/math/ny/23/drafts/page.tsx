'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson23-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/23"
      lessonId="23"
      problems={PROBLEMS}
    />
  )
}
