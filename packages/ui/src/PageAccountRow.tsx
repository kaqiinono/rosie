import clsx from 'clsx'
import type { ReactNode } from 'react'
import AccountBar from './AccountBar'

export function PageAccountRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('@container flex w-full items-center justify-between gap-2', className)}>
      {children}
      <div className="hidden shrink-0 empty:hidden @xs:block print:hidden">
        <AccountBar variant="menu" />
      </div>
    </div>
  )
}
