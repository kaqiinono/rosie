'use client'

import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NavigationLink from './NavigationLink'

interface BackLinkProps {
  href?: string
  label?: string
}

export default function BackLink({ href = '/', label = '返回首页' }: BackLinkProps) {
  return (
    <NavigationLink href={href} className="fixed top-4 left-4 z-10">
      <Button variant="outline" size="sm" className="gap-1 border-black/6 bg-white/80 text-slate-500 shadow-sm backdrop-blur-xl hover:text-slate-800">
        <ChevronLeft className="!size-3.5" />
        {label}
      </Button>
    </NavigationLink>
  )
}
