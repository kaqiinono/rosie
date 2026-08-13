'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

/**
 * Persistent site logo — fixed top-left, transparent background,
 * clickable to return to home page.
 *
 * Pages that render their own sticky/fixed header in the top-left
 * should add `pl-[52px] sm:pl-[60px]` to their header's inner container
 * so the back-button / title does not overlap the logo.
 */
export default function LogoLink() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  return (
    <Link
      href="/"
      aria-label="返回首页"
      className={`fixed top-0 left-0 z-[100] flex items-center gap-1.5 bg-transparent no-underline transition-opacity hover:opacity-80 ${
        isHome ? 'pointer-events-none opacity-0' : ''
      }`}
      style={{ padding: '8px 10px' }}
      tabIndex={isHome ? -1 : 0}
    >
      <Image
        src="/icons/favicon-32.png"
        alt="Rosie Fun"
        width={28}
        height={28}
        className="block"
      />
    </Link>
  )
}
