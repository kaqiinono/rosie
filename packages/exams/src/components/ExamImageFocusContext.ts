'use client'

import { createContext, useContext, type MouseEvent } from 'react'

export const ExamImageFocusContext = createContext<{
  expanded: boolean
  open?: (event: MouseEvent<HTMLButtonElement>, slotId?: string) => void
}>({ expanded: false })

export const useExamImageFocus = () => useContext(ExamImageFocusContext)
