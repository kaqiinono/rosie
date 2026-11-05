'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson13 } from './G2Lesson13Provider'

export default function BottomNav() {
  return (
    <LessonBottomNav
      config={{ basePath: '/math/ny/2/13', activeColor: 'text-amber-700' }}
      useLessonContext={useG2Lesson13}
    />
  )
}
