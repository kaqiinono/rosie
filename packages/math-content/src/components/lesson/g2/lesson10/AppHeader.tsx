'use client'

import type { ProblemSet } from '@rosie/core'
import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import { useG2Lesson10 } from './G2Lesson10Provider'

const CONFIG = { basePath: '/math/ny/2/10', emoji: '🐔', titleShort: '鸡兔同笼', titleFull: '鸡兔同笼初步', titleColor: 'text-amber-700', navActiveColor: 'text-amber-700', navActiveBorderColor: '#b45309' } as const
export default function AppHeader({ problems }: { problems: ProblemSet }) { return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson10} /> }
