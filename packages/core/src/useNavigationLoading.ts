'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function useNavigationLoading() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigateTo = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href)
      })
    },
    [router, startTransition]
  )

  return { isLoading: isPending, navigateTo }
}
