'use client'

import { usePathname } from 'next/navigation'
import AccountBar from './AccountBar'
import StarHud from '@/components/stars/StarHud'
import { useImmersive } from '@/contexts/ImmersiveContext'

function hidesGlobalChrome(pathname: string): boolean {
  return pathname === '/flipbook' || pathname === '/flipbook/admin'
}

export default function TopRightBar() {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  if (isImmersive || hidesGlobalChrome(pathname)) return null

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center justify-end gap-1.5">
      <div className="pointer-events-auto flex items-center gap-1.5">
        <StarHud />
        <AccountBar />
      </div>
    </div>
  )
}
