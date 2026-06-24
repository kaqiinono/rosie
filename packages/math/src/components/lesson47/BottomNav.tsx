'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson47 } from './Lesson47Provider'

const CONFIG = {
  basePath: '/math/ny/47',
  activeColor: 'text-fuchsia-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson47} />
}
