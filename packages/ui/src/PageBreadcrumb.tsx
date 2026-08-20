'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buildBreadcrumb, type BreadcrumbItem } from './breadcrumb-map'

type PageBreadcrumbProps = {
  /** fixed=左上角悬浮（默认）；inline=无定位，由调用方放入 header 等容器 */
  variant?: 'fixed' | 'inline'
}

/** 单级回退（上级即首页）或未知路由时的「返回首页」按钮，视觉沿用原 BackLink */
function BackHomeLink({ variant }: { variant: 'fixed' | 'inline' }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-1.5 rounded-xl border border-black/6 bg-white/80 px-3.5 py-2 text-[13px] font-bold text-slate-500 shadow-sm backdrop-blur-xl transition-all hover:-translate-x-0.5 hover:border-black/12 hover:text-slate-800 ${
        variant === 'fixed' ? 'fixed top-4 left-14 z-10' : ''
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      返回首页
    </Link>
  )
}

/**
 * 面包屑导航：按路由映射表自动生成层级链，每层可点击回退。
 * 上级为首页或未知路由时退化为「返回首页」按钮。
 */
export default function PageBreadcrumb({ variant = 'fixed' }: PageBreadcrumbProps) {
  const pathname = usePathname()
  const items = buildBreadcrumb(pathname)

  if (!items || items.length <= 1) return <BackHomeLink variant={variant} />

  const links: BreadcrumbItem[] = [{ label: '首页', href: '/' }, ...items.slice(0, -1)]
  const current = items[items.length - 1]

  return (
    <nav
      aria-label="面包屑导航"
      className={`flex max-w-[calc(100vw-72px)] flex-wrap items-center rounded-xl border border-black/6 bg-white/80 px-3.5 py-2 text-[13px] font-bold shadow-sm backdrop-blur-xl ${
        variant === 'fixed' ? 'fixed top-4 left-14 z-10' : ''
      }`}
    >
      {links.map((item) => (
        <Fragment key={item.href}>
          <Link
            href={item.href}
            className="cursor-pointer whitespace-nowrap text-slate-500 transition-colors hover:text-slate-800"
          >
            {item.label}
          </Link>
          <span className="px-1.5 text-slate-300" aria-hidden>
            ›
          </span>
        </Fragment>
      ))}
      <span className="whitespace-nowrap text-slate-800" aria-current="page">
        {current.label}
      </span>
    </nav>
  )
}
