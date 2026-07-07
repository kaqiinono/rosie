'use client'

import { usePathname } from 'next/navigation'
import AccountBar from './AccountBar'
import { StarHud } from '@rosie/rewards'
import { useImmersive } from '@rosie/core'

const HOME_PAGES = ['/', '/math', '/today', '/vouchers']

function showsGlobalChrome(pathname: string): boolean {
  return HOME_PAGES.includes(pathname)
}

export default function TopRightBar() {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  if (isImmersive || !showsGlobalChrome(pathname)) return null

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center justify-end gap-1.5">
      <div className="pointer-events-auto flex items-center gap-1.5">
        <div className="hidden md:block">
          <StarHud />
        </div>
        <AccountBar />
      </div>
    </div>
  )
}
