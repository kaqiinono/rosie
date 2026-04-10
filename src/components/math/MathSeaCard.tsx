import Link from 'next/link'
import { SEA_POOL } from '@/utils/sea-data'

export default function MathSeaCard() {
  const total = SEA_POOL.length

  return (
    <Link
      href="/math/sea"
      className="group relative block w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(99,102,241,.25)]"
      style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #ede9fe 100%)',
        border: '2px solid rgba(99,102,241,.3)',
        boxShadow: '0 4px 20px rgba(99,102,241,.12)',
      }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-purple-300/25 blur-xl" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🌊</span>
            <span className="text-[14px] font-extrabold text-indigo-800 tracking-tight">题海</span>
          </div>
          <span className="text-[12px] font-bold text-indigo-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] text-indigo-700/80 font-medium leading-relaxed">
          全部 <strong className="text-indigo-800">{total}</strong> 道题<br />
          搜索·筛选·随机练
        </div>
      </div>
    </Link>
  )
}
