'use client'

import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('G2Lesson2')

export default Provider
export { useLessonContext as useG2Lesson2 }
