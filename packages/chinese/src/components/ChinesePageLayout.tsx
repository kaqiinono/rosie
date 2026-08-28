import type { ReactNode } from 'react'

type ChinesePageWidth = 'focused' | 'standard' | 'wide'

type ChinesePageShellProps = {
  children: ReactNode
  width?: ChinesePageWidth
  className?: string
}

type ChinesePageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  eyebrow?: ReactNode
  className?: string
}

const WIDTH_CLASS: Record<ChinesePageWidth, string> = {
  focused: 'max-w-2xl',
  standard: 'max-w-5xl',
  wide: 'max-w-[1280px]',
}

export function ChinesePageShell({
  children,
  width = 'standard',
  className = '',
}: ChinesePageShellProps) {
  return (
    <main
      className={`mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${WIDTH_CLASS[width]} ${className}`}
    >
      {children}
    </main>
  )
}

export function ChinesePageHeader({
  title,
  description,
  action,
  eyebrow,
  className = '',
}: ChinesePageHeaderProps) {
  return (
    <header
      className={`mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-amber-700 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl leading-tight font-black text-slate-900 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 font-medium text-slate-500 sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </header>
  )
}

export type { ChinesePageHeaderProps, ChinesePageShellProps, ChinesePageWidth }
