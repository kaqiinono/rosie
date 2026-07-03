import Link from 'next/link'

export default function MathPriorityCard() {
  return (
    <Link
      href="/math/priority"
      className="group relative block h-full w-full overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(16,185,129,.25)]"
      style={{
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #ccfbf1 100%)',
        border: '2px solid rgba(16,185,129,.3)',
        boxShadow: '0 4px 20px rgba(16,185,129,.12)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-emerald-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-teal-300/25 blur-xl" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🧄</span>
            <span className="text-[14px] font-extrabold tracking-tight text-emerald-800">大纲</span>
          </div>
          <span className="text-[12px] font-bold text-emerald-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-emerald-700/80">
          知识点分析
          <br />
          模块优先级·复习计划
        </div>
      </div>
    </Link>
  )
}
