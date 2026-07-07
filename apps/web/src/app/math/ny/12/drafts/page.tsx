'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson12-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/12"
      lessonId="12"
      problems={PROBLEMS}
    />
  )
}
