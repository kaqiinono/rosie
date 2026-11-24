'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AuthGuard, TopRightBar } from '@rosie/ui'
import { StarBurst, StarHudProvider } from '@rosie/rewards'
import AiFloatingAssistantHost from './AiFloatingAssistantHost'
import { useOfflineRouting } from './offline/useOfflineRouting'
import TimeTreeLauncher from './time-tree/TimeTreeLauncher'

export default function AppContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  useOfflineRouting(pathname === '/' ? 'home' : null)
  if (pathname === '/offline') return children

  return <AuthGuard>
    <StarHudProvider>
      <TopRightBar />
      <TimeTreeLauncher>
        {children}
        <AiFloatingAssistantHost />
      </TimeTreeLauncher>
      <StarBurst />
    </StarHudProvider>
  </AuthGuard>
}
