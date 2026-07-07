'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson46-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/46"
      lessonId="46"
      problems={PROBLEMS}
    />
  )
}
