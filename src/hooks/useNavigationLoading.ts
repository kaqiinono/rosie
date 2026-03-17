'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function useNavigationLoading() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [, startTransition] = useTransition()

  const navigateTo = useCallback(
    (href: string) => {
      setIsLoading(true)
      startTransition(() => {
        router.push(href)
      })
    },
    [router, startTransition]
  )

  return { isLoading, navigateTo, setIsLoading }
}
