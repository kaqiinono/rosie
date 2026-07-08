'use client'

import { MathFavoritesProvider, PracticeQueueProvider } from '@rosie/math'

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return (
    <MathFavoritesProvider>
      <PracticeQueueProvider>{children}</PracticeQueueProvider>
    </MathFavoritesProvider>
  )
}
