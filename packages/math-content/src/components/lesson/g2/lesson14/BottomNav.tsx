'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson14 } from './G2Lesson14Provider'

export default function BottomNav() {
  return (
    <LessonBottomNav
      config={{ basePath: '/math/ny/2/14', activeColor: 'text-teal-700' }}
      useLessonContext={useG2Lesson14}
    />
  )
}
