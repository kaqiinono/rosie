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

/* 背景只用奶油纸张底色（body）+ 几颗不透明的柔彩圆点，不用渐变和模糊，像贴在纸上的圆形贴纸。 */
const HOME_ORBS: OrbConfig[] = [
  { size: 'w-72 h-72', position: '-top-16 -left-20', color: 'bg-amber-200/60' },
  {
    size: 'w-60 h-60',
    position: '-bottom-12 -right-16',
    color: 'bg-rose-200/50',
    delay: 'animation-delay-[-6s]',
    duration: '[animation-duration:22s]',
  },
  {
    size: 'w-40 h-40',
    position: 'top-1/2 left-[58%]',
    color: 'bg-sky-200/50',
    delay: 'animation-delay-[-12s]',
    duration: '[animation-duration:25s]',
  },
]

const MATH_ORBS: OrbConfig[] = [
  { size: 'w-64 h-64', position: '-top-12 -left-16', color: 'bg-sky-200/50' },
  {
    size: 'w-52 h-52',
    position: '-bottom-8 -right-12',
    color: 'bg-amber-200/60',
    delay: 'animation-delay-[-7s]',
  },
  {
    size: 'w-36 h-36',
    position: 'top-[40%] left-[60%]',
    color: 'bg-violet-200/50',
    delay: 'animation-delay-[-14s]',
  },
]

export default function OrbBackground({ variant = 'home' }: OrbBackgroundProps) {
  const orbs = variant === 'home' ? HOME_ORBS : MATH_ORBS

  return (
    <>
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`animate-orb-float pointer-events-none fixed z-0 rounded-full ${orb.size} ${orb.position} ${orb.color} ${orb.delay ?? ''} ${orb.duration ?? ''}`}
        />
      ))}
    </>
  )
}
