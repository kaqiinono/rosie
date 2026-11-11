import Link from 'next/link'

export default function MathQuizCard() {
  return (
    <Link
      href="/math/ny/quiz"
      className="group hover:shadow-sticker relative flex h-full w-full flex-col overflow-hidden rounded-[20px] no-underline transition-all duration-300 hover:-translate-y-1"
      style={{
        background: '#fae8ff',
        border: '2px solid rgba(168,85,247,.3)',
        boxShadow: '0 3px 0 rgba(168,85,247,.3)',
      }}
    >
      <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-purple-300/20" />
      <div className="pointer-events-none absolute -bottom-4 left-8 h-16 w-16 rounded-full bg-violet-300/25" />

      <div className="relative px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📝</span>
            <span className="text-[14px] font-extrabold tracking-tight text-purple-800">组卷</span>
          </div>
          <span className="text-[12px] font-bold text-purple-500 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
        <div className="text-[11px] leading-relaxed font-medium text-purple-700/80">
          跨课组卷
          <br />
          筛选·推荐·PDF
        </div>
      </div>
    </Link>
  )
}
