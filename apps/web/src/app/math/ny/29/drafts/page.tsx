'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson29-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/29"
      lessonId="29"
      problems={PROBLEMS}
    />
  )
}
