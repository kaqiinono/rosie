'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson47-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/47"
      lessonId="47"
      problems={PROBLEMS}
    />
  )
}
