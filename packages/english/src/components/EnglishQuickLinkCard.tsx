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
      title={description}
      className="flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 no-underline transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-indigo-500"
      style={{ background: gradient, borderColor: border, boxShadow: shadow, color: text }}
    >
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-white px-1.5 text-xs font-bold tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  )
}
