'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson50-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/50"
      lessonId="50"
      problems={PROBLEMS}
    />
  )
}
