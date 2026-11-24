'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@rosie/core'
import AuthSkeleton from './AuthSkeleton'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const localPage = pathname === '/auth'

  useEffect(() => {
    if (!loading && !user && !localPage) {
      router.replace('/auth')
    }
  }, [user, loading, localPage, router])

  if (localPage) return <>{children}</>
  if (loading) return <AuthSkeleton />
  if (!user) return null

  return <>{children}</>
}
