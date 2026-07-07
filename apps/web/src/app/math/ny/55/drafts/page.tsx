'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson55-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/55"
      lessonId="55"
      problems={PROBLEMS}
    />
  )
}
