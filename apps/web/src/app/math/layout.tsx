'use client'

import { MathFavoritesProvider } from '@rosie/math'

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return <MathFavoritesProvider>{children}</MathFavoritesProvider>
}
