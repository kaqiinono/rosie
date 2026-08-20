'use client'

import { usePathname } from 'next/navigation'
import AccountBar from './AccountBar'
import { StarHud } from '@rosie/rewards'
import { useImmersive } from '@rosie/core'

const HOME_PAGES = ['/', '/math', '/vouchers']

function showsGlobalChrome(pathname: string): boolean {
  return HOME_PAGES.includes(pathname)
}

export default function TopRightBar() {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  if (isImmersive || !showsGlobalChrome(pathname)) return null

  const positionClassName =
    pathname === '/'
      ? 'left-1/2 w-[calc(100%-2.5rem)] max-w-[1040px] -translate-x-1/2'
      : 'right-3 max-w-[calc(100vw-1.5rem)]'

  return (
    <div
      className={`pointer-events-none fixed top-3 z-50 flex items-center justify-end gap-1.5 ${positionClassName}`}
    >
      <div className="pointer-events-auto flex items-center gap-1.5">
        <StarHud />
        <AccountBar />
      </div>
    </div>
  )
}
