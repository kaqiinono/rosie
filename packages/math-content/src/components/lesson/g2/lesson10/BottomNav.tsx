'use client'

import LessonBottomNav from '@rosie/math-kit/components/shared/LessonBottomNav'
import { useG2Lesson10 } from './G2Lesson10Provider'

export default function BottomNav() { return <LessonBottomNav config={{ basePath: '/math/ny/2/10', activeColor: 'text-amber-700' }} useLessonContext={useG2Lesson10} /> }
