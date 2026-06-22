import Link from 'next/link'
import { BOOKS } from '@rosie/math/utils/catalog-data'

export default function MathCatalogCard() {
  const total = Object.keys(BOOKS).length

  return (
    <Link
      href="/math/catalog"
      className="group relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(59,130,246,.25)]"
      style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0f2fe 100%)',
        border: '2px solid rgba(59,130,246,.3)',
        boxShadow: '0 4px 20px rgba(59,130,246,.12)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-sky-300/25 blur-xl" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📚</span>
            <span className="text-[14px] font-extrabold tracking-tight text-blue-800">图谱</span>
          </div>
          <span className="text-[12px] font-bold text-blue-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-blue-700/80">
          <strong className="text-blue-800">{total}</strong> 本教材题型
          <br />
          检索·导图·路径
        </div>
      </div>
    </Link>
  )
}
