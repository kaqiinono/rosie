'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson15-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/15"
      lessonId="15"
      problems={PROBLEMS}
    />
  )
}
