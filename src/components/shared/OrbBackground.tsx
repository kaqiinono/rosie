interface OrbConfig {
  size: string
  position: string
  color: string
  delay?: string
  duration?: string
}

interface OrbBackgroundProps {
  variant?: 'home' | 'math'
}

const HOME_GRADIENT = `radial-gradient(ellipse_80%_60%_at_20%_10%,rgba(99,102,241,.08),transparent),
  radial-gradient(ellipse_70%_50%_at_80%_85%,rgba(16,185,129,.08),transparent),
  radial-gradient(ellipse_50%_40%_at_55%_40%,rgba(251,191,36,.06),transparent),
  linear-gradient(160deg,#eef3ff_0%,#f8fbff_40%,#ecfff7_70%,#fef9ec_100%)`

const MATH_GRADIENT = `radial-gradient(ellipse_70%_50%_at_25%_15%,rgba(59,130,246,.07),transparent),
  radial-gradient(ellipse_60%_45%_at_75%_80%,rgba(251,191,36,.08),transparent),
  radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(139,92,246,.05),transparent),
  linear-gradient(160deg,#eef3ff_0%,#fef9ec_50%,#f0f4ff_100%)`

const HOME_ORBS: OrbConfig[] = [
  { size: 'w-80 h-80', position: '-top-15 -left-20', color: 'bg-indigo-500/12' },
  { size: 'w-70 h-70', position: '-bottom-10 -right-15', color: 'bg-emerald-500/10', delay: 'animation-delay-[-6s]', duration: '[animation-duration:22s]' },
  { size: 'w-50 h-50', position: 'top-1/2 left-[55%]', color: 'bg-amber-400/8', delay: 'animation-delay-[-12s]', duration: '[animation-duration:25s]' },
]

const MATH_ORBS: OrbConfig[] = [
  { size: 'w-70 h-70', position: '-top-12 -left-15', color: 'bg-blue-500/10' },
  { size: 'w-60 h-60', position: '-bottom-8 -right-12', color: 'bg-amber-400/10', delay: 'animation-delay-[-7s]' },
  { size: 'w-45 h-45', position: 'top-[40%] left-[60%]', color: 'bg-violet-500/7', delay: 'animation-delay-[-14s]' },
]

export default function OrbBackground({ variant = 'home' }: OrbBackgroundProps) {
  const gradient = variant === 'home' ? HOME_GRADIENT : MATH_GRADIENT
  const orbs = variant === 'home' ? HOME_ORBS : MATH_ORBS

  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none dark:opacity-60"
        style={{ background: gradient.replace(/\n\s*/g, '') }}
      />
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`fixed rounded-full blur-[80px] pointer-events-none z-0 animate-orb-float ${orb.size} ${orb.position} ${orb.color} ${orb.delay ?? ''} ${orb.duration ?? ''}`}
        />
      ))}
    </>
  )
}
