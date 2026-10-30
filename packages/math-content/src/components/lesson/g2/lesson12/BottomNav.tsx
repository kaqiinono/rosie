'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson12 } from './G2Lesson12Provider'

export default function BottomNav() {
  return (
    <LessonBottomNav
      config={{ basePath: '/math/ny/2/12', activeColor: 'text-amber-700' }}
      useLessonContext={useG2Lesson12}
    />
  )
}
