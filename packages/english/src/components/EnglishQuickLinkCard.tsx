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
      className="group relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1"
      style={{
        background: gradient,
        border: `2px solid ${border}`,
        boxShadow: shadow,
      }}
    >
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full blur-2xl opacity-30"
        style={{ background: border }}
      />
      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xl">{icon}</span>
            <span className="truncate text-[14px] font-extrabold tracking-tight" style={{ color: text }}>
              {label}
            </span>
            {badge && (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, #e94560, #f472b6)' }}
              >
                {badge}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[12px] font-bold opacity-60 transition-transform group-hover:translate-x-0.5" style={{ color: text }}>
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium opacity-80" style={{ color: text }}>
          {description}
        </div>
      </div>
    </Link>
  )
}
