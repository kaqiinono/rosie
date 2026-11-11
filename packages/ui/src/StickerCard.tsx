import clsx from 'clsx'
import { cloneElement, isValidElement } from 'react'
import type { ElementType, HTMLAttributes, ReactElement, ReactNode } from 'react'

// 「软糖贴纸」卡片：2px 暖色描边 + 平底边阴影 + 大圆角。
// 业务页的卡片 / 面板 / 统计块统一用它，不要再手写 `rounded-* border-2 bg-white shadow-sticker*`。
// 外观只通过 tone / size / elevation / radius / interactive 选择；className 只用于布局（宽度、间距、定位）。

export type StickerCardTone =
  | 'white'
  | 'paper'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
export type StickerCardSize = 'none' | 'sm' | 'md' | 'lg'
export type StickerCardElevation = 'flat' | 'sm' | 'md' | 'lg'
export type StickerCardRadius = 'md' | 'lg'

export type StickerCardProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  children?: ReactNode
  /** 渲染的元素，默认 div。列表项用 li，语义区块用 section / article。 */
  as?: 'div' | 'section' | 'article' | 'aside' | 'li' | 'header' | 'footer'
  /** 底色：white 通用；paper 奶油色（嵌套在白卡里的次级块）；accent 强调；其余为状态色。 */
  tone?: StickerCardTone
  /** 内边距：none=0，sm=12px，md=16px（≥sm 屏 20px），lg=24px。 */
  size?: StickerCardSize
  /** 底边厚度：flat 无，sm 2px（列表项），md 4px（默认），lg 6px（主面板）。 */
  elevation?: StickerCardElevation
  /** 圆角：md=1rem（小块、列表项），lg=1.5rem（默认）。 */
  radius?: StickerCardRadius
  /** 把卡片外观套到唯一子元素上（如 next/link 的 <Link>、<a>），不额外渲染外层元素。 */
  asChild?: boolean
  /** 可点击卡片：悬停上浮、按下回弹（带 prefers-reduced-motion 回退）。 */
  interactive?: boolean
}

const TONE: Record<StickerCardTone, string> = {
  white: 'bg-white border-kid-line',
  paper: 'bg-kid-paper border-kid-line',
  accent: 'bg-[var(--accent-2)] border-[var(--accent-6)]',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-300',
  danger: 'bg-red-50 border-red-200',
  info: 'bg-sky-50 border-sky-200',
}

const SIZE: Record<StickerCardSize, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6',
}

const ELEVATION: Record<StickerCardElevation, string> = {
  flat: '',
  sm: 'shadow-sticker-sm',
  md: 'shadow-sticker',
  lg: 'shadow-sticker-lg',
}

const RADIUS: Record<StickerCardRadius, string> = {
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
}

const INTERACTIVE =
  'cursor-pointer transition-transform duration-200 ease-spring motion-reduce:transition-none ' +
  'hover:-translate-y-0.5 active:translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0'

export function StickerCard({
  as = 'div',
  tone = 'white',
  size = 'md',
  elevation = 'md',
  radius = 'lg',
  interactive = false,
  asChild = false,
  className,
  children,
  ...rest
}: StickerCardProps) {
  const Tag: ElementType = as
  const classes = clsx(
    'border-2',
    TONE[tone],
    SIZE[size],
    ELEVATION[elevation],
    RADIUS[radius],
    interactive && INTERACTIVE,
    className,
  )
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>
    return cloneElement(child, {
      ...rest,
      className: clsx(classes, child.props.className),
    } as Record<string, unknown>)
  }
  return (
    <Tag {...rest} className={classes}>
      {children}
    </Tag>
  )
}

export default StickerCard
