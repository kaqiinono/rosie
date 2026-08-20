'use client'

import { usePathname } from 'next/navigation'
import AccountBar from './AccountBar'
import { StarHud } from '@rosie/rewards'
import { useImmersive } from '@rosie/core'

function showsGlobalChrome(pathname: string): boolean {
  return pathname === '/'
}

export default function TopRightBar() {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  if (isImmersive || !showsGlobalChrome(pathname)) return null

  return (
    <div
      className="pointer-events-none fixed top-3 left-1/2 z-50 flex w-[calc(100%-2.5rem)] max-w-[1040px] items-center justify-end gap-1.5 -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-1.5">
        <StarHud />
        <AccountBar />
      </div>
    </div>
  )
}
