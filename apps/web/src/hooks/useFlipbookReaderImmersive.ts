'use client'

import { useEffect } from 'react'
import { useImmersive } from '@/contexts/ImmersiveContext'

/** Hide global chrome and lock document scroll while on a flipbook reader route. */
export function useFlipbookReaderImmersive(active = true) {
  const { setIsImmersive } = useImmersive()

  useEffect(() => {
    if (!active) return
    setIsImmersive(true)
    const prevOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      setIsImmersive(false)
      document.documentElement.style.overflow = prevOverflow
    }
  }, [active, setIsImmersive])
}
