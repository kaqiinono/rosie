'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson38-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/38"
      lessonId="38"
      problems={PROBLEMS}
    />
  )
}
