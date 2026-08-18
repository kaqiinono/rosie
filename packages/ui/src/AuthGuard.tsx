'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@rosie/core'
import AuthSkeleton from './AuthSkeleton'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user && pathname !== '/auth') {
      router.replace('/auth')
    }
  }, [user, loading, pathname, router])

  if (loading) return <AuthSkeleton />
  if (!user && pathname !== '/auth') return null

  return <>{children}</>
}
