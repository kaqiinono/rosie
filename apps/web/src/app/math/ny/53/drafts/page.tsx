'use client'

import { PROBLEMS } from '@rosie/math/utils/lesson53-data'
import LessonDraftsPage from '@rosie/math/components/shared/LessonDraftsPage'

export default function DraftsPage() {
  return (
    <LessonDraftsPage
      basePath="/math/ny/53"
      lessonId="53"
      problems={PROBLEMS}
    />
  )
}
