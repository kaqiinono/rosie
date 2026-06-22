'use client'

import { useNavigationLoading } from '@/hooks/useNavigationLoading'
import LoadingOverlay from './LoadingOverlay'
import type { ReactNode } from 'react'

interface NavigationLinkProps {
  href: string
  children: ReactNode
  className?: string
}

export default function NavigationLink({ href, children, className }: NavigationLinkProps) {
  const { isLoading, navigateTo } = useNavigationLoading()

  return (
    <>
      <LoadingOverlay visible={isLoading} />
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigateTo(href)}
        onKeyDown={(e) => e.key === 'Enter' && navigateTo(href)}
        className={className}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </div>
    </>
  )
}
