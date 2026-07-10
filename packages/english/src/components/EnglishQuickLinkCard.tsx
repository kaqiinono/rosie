import Link from 'next/link'

export type EnglishQuickLinkCardProps = {
  href: string
  icon: string
  label: string
  description: string
  gradient: string
  border: string
  shadow: string
  text: string
  badge?: string
}

export default function EnglishQuickLinkCard({
  href,
  icon,
  label,
  description,
  gradient,
  border,
  shadow,
  text,
  badge,
}: EnglishQuickLinkCardProps) {
  return (
    <Link
      href={href}
      className="group relative block h-full min-h-[120px] w-full overflow-hidden rounded-[24px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(0,0,0,.1)]"
      style={{
        background: gradient,
        border: `2px solid ${border}`,
        boxShadow: shadow,
      }}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl opacity-30"
        style={{ background: border }}
      />
      <div className="relative px-5 py-5 min-[501px]:px-6 min-[501px]:py-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-3xl">{icon}</span>
            <span className="truncate text-base font-extrabold tracking-tight min-[501px]:text-lg" style={{ color: text }}>
              {label}
            </span>
            {badge && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, #e94560, #f472b6)' }}
              >
                {badge}
              </span>
            )}
          </div>
          <span className="shrink-0 text-sm font-bold opacity-60 transition-transform group-hover:translate-x-0.5" style={{ color: text }}>
            →
          </span>
        </div>
        <div className="text-sm leading-relaxed font-medium opacity-80" style={{ color: text }}>
          {description}
        </div>
      </div>
    </Link>
  )
}
