'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson9 } from './G2Lesson9Provider'

const CONFIG = { basePath: '/math/ny/2/9', activeColor: 'text-amber-700' } as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG2Lesson9} />
}
