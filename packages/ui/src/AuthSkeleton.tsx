'use client'

import OrbBackground from './OrbBackground'

function PulseBlock({
  className,
  delay = 0,
}: {
  className: string
  delay?: number
}) {
  return (
    <div
      className={`rounded-2xl bg-slate-200/60 ${className}`}
      style={{
        animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${delay}ms infinite`,
      }}
    />
  )
}

export default function AuthSkeleton() {
  return (
    <>
      <OrbBackground variant="home" />

      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center gap-9 px-5 py-8 pt-12 pb-12">
        {/* Logo + greeting area */}
        <section className="flex max-w-[540px] flex-col items-center gap-3">
          <PulseBlock className="h-28 w-32" delay={0} />
          <PulseBlock className="h-4 w-40" delay={80} />
          <PulseBlock className="h-8 w-64" delay={160} />
        </section>

        {/* Today plan — 4 cards row */}
        <section className="grid w-full max-w-[1040px] grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PulseBlock
              key={i}
              className="h-[108px]"
              delay={200 + i * 80}
            />
          ))}
        </section>

        {/* Stats panel collapsed bar */}
        <PulseBlock className="h-11 w-full max-w-[1040px]" delay={560} />

        {/* Module cards grid */}
        <section className="grid w-full max-w-[1040px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PulseBlock
              key={i}
              className="h-[220px]"
              delay={640 + i * 60}
            />
          ))}
        </section>

        {/* Footer line */}
        <PulseBlock className="h-3 w-48" delay={1000} />
      </div>
    </>
  )
}
