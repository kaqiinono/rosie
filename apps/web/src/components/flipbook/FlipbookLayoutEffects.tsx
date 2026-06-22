'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useImmersive } from '@/contexts/ImmersiveContext'

function isFlipbookReaderPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length === 2 && parts[0] === 'flipbook' && parts[1] !== 'admin'
}

export default function FlipbookLayoutEffects({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setIsImmersive } = useImmersive()

  useEffect(() => {
    if (!isFlipbookReaderPath(pathname)) {
      setIsImmersive(false)
    }
  }, [pathname, setIsImmersive])

  return <>{children}</>
}
