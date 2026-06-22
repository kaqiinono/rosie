'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson40 } from './Lesson40Provider'

const CONFIG = {
  basePath: '/math/ny/40',
  activeColor: 'text-green-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson40} />
}
