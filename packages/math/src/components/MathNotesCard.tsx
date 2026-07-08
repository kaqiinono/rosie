import Link from 'next/link'

export default function MathNotesCard() {
  return (
    <Link
      href="/math/notes"
      className="group relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(139,92,246,.25)]"
      style={{
        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)',
        border: '2px solid rgba(139,92,246,.3)',
        boxShadow: '0 4px 20px rgba(139,92,246,.12)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-violet-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-indigo-300/25 blur-xl" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📝</span>
            <span className="text-[14px] font-extrabold tracking-tight text-violet-800">汇总笔记</span>
          </div>
          <span className="text-[12px] font-bold text-violet-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-violet-700/80">
          跨讲汇总
          <br />
          按年级·讲次筛选
        </div>
      </div>
    </Link>
  )
}
