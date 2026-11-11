import clsx from 'clsx'
import Link from 'next/link'
import type { ReactNode } from 'react'
import PageBreadcrumb from './PageBreadcrumb'

// 标准页面外壳：整页底色 + 粘性页头（返回 / 标题 / 右侧操作）+ 内容区宽度与内边距。
// 业务页（设置、管理、今日等）一律用它，不要再手写 `min-h-screen` + 自己的 header。
// 沉浸式页面（口算深色、题海、做题全屏）不适用。

export type PageShellTone = 'paper' | 'rose' | 'mint' | 'peach' | 'sky'
export type PageShellWidth = 'narrow' | 'default' | 'wide' | 'full'

export type PageShellProps = {
  title: ReactNode
  /** 标题下方的小字（日期、说明）。 */
  subtitle?: ReactNode
  /** 标题前的 emoji / 图标。 */
  icon?: ReactNode
  /** 提供时显示圆形返回按钮；不提供则显示 PageBreadcrumb（按 breadcrumb-map 自动生成）。 */
  backHref?: string
  /** 返回按钮的无障碍文字，默认「返回」。 */
  backLabel?: string
  /** 页头右侧的操作区（链接、按钮）。 */
  actions?: ReactNode
  /** 底色：paper 奶油（默认）；rose 管理 / 设置；mint 今日；peach 计划；sky 数学。 */
  tone?: PageShellTone
  /** 页头与内容区的最大宽度：narrow 860 / default 1024 / wide 1280 / full 不限。 */
  width?: PageShellWidth
  /** false 时内容区不加容器与内边距，由页面自己控制（页头仍然生效）。 */
  padded?: boolean
  children?: ReactNode
}

const TONE: Record<PageShellTone, string> = {
  paper: 'bg-kid-paper',
  rose: 'bg-rose-50',
  mint: 'bg-green-50',
  peach: 'bg-orange-50',
  sky: 'bg-sky-50',
}

const WIDTH: Record<PageShellWidth, string> = {
  narrow: 'max-w-[860px]',
  default: 'max-w-[1024px]',
  wide: 'max-w-[1280px]',
  full: 'max-w-none',
}

export function PageShell({
  title,
  subtitle,
  icon,
  backHref,
  backLabel = '返回',
  actions,
  tone = 'paper',
  width = 'default',
  padded = true,
  children,
}: PageShellProps) {
  return (
    <div className={clsx('min-h-screen text-[15px]', TONE[tone])}>
      <header className="border-kid-line sticky top-0 z-30 border-b-2 bg-white">
        <div className={clsx('mx-auto flex min-h-14 items-center gap-3 px-4 py-2', WIDTH[width])}>
          {backHref ? (
            <Link
              href={backHref}
              aria-label={backLabel}
              className="border-kid-line shadow-sticker-sm ease-spring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[var(--accent-11)] no-underline transition-transform duration-200 hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:hover:translate-x-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          ) : (
            <PageBreadcrumb variant="inline" />
          )}

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon ? (
              <span className="shrink-0 text-xl" aria-hidden>
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-[17px] leading-tight font-extrabold text-[var(--accent-11)]">
                {title}
              </h1>
              {subtitle ? (
                <div className="truncate text-[11px] leading-tight font-semibold text-slate-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      </header>

      {padded ? (
        <main className={clsx('mx-auto w-full px-4 py-6 pb-20', WIDTH[width])}>{children}</main>
      ) : (
        children
      )}
    </div>
  )
}

export default PageShell
