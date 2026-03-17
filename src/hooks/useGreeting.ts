'use client'

import { useState, useEffect } from 'react'
import { getGreeting } from '@/utils/greeting'

export function useGreeting() {
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  return greeting
}
