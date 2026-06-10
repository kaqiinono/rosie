'use client'

import Link from 'next/link'

export default function PretestPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="text-5xl">📝</div>
      <div className="text-[15px] font-bold text-text-primary">第29讲没有课前测</div>
      <div className="text-[13px] text-text-muted">本讲直接进入课堂讲解</div>
      <Link
        href="/math/ny/29/lesson"
        className="mt-2 rounded-full bg-rose-500 px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(225,29,72,0.3)]"
      >
        去课堂讲解 →
      </Link>
    </div>
  )
}
