'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson36-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/36"
      lessonId="36"
      problems={PROBLEMS}
    />
  )
}
