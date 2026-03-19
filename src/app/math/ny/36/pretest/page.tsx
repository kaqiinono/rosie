'use client'

import Link from 'next/link'

export default function PretestPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-5xl">📝</div>
      <div className="text-[15px] font-bold text-text-primary">课前测暂未开放</div>
      <div className="text-[13px] text-text-muted">第36讲课前测题目即将上线，敬请期待</div>
      <Link
        href="/math/ny/36"
        className="mt-2 rounded-full bg-app-blue px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
      >
        返回首页 →
      </Link>
    </div>
  )
}
