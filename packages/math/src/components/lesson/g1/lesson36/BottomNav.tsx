'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useG1Lesson36 } from './G1Lesson36Provider'

const CONFIG = {
  basePath: '/math/ny/1/36',
  activeColor: 'text-app-blue-dark',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useG1Lesson36} />
}
