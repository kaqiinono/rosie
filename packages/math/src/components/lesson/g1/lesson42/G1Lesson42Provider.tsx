'use client'

import { createLessonProvider } from '@rosie/math/components/shared/createLessonProvider'

const { Provider, useLessonContext } = createLessonProvider('G1Lesson42')

export default Provider
export { useLessonContext as useG1Lesson42 }
