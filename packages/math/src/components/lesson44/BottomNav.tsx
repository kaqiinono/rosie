'use client'

import LessonBottomNav from '@rosie/math/components/shared/LessonBottomNav'
import { useLesson44 } from './Lesson44Provider'

const CONFIG = {
  basePath: '/math/ny/44',
  activeColor: 'text-indigo-700',
} as const

export default function BottomNav() {
  return <LessonBottomNav config={CONFIG} useLessonContext={useLesson44} />
}
