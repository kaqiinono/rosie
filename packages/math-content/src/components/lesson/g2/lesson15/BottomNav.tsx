'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson15 } from './G2Lesson15Provider'

export default function BottomNav() {
  return (
    <LessonBottomNav
      config={{
        basePath: '/math/ny/2/15',
        activeColor: 'text-teal-700',
        secondarySection: 'supplement',
      }}
      useLessonContext={useG2Lesson15}
    />
  )
}
