'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson39-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/39"
      lessonId="39"
      problems={PROBLEMS}
    />
  )
}
