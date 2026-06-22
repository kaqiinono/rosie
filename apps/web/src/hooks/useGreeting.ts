'use client'

import { useState } from 'react'
import { getGreeting } from '@/utils/greeting'

export function useGreeting() {
  const [greeting] = useState(() => getGreeting())
  return greeting
}
