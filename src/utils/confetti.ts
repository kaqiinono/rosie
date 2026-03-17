import { CONFETTI_COLORS } from './constant'

export function launchConfetti(count = 30) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const sz = 6 + Math.random() * 8
    Object.assign(el.style, {
      position: 'fixed',
      width: `${sz}px`,
      height: `${sz}px`,
      borderRadius: '2px',
      background: color,
      left: `${Math.random() * 100}vw`,
      top: '-10px',
      opacity: '1',
      zIndex: '9999',
      pointerEvents: 'none',
      animation: `fall ${1 + Math.random() * 2}s linear forwards`,
    })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3000)
  }
}

export function pickDifferent<T>(arr: T[], exclude: T): T {
  const choices = arr.filter(v => v !== exclude)
  return choices[Math.floor(Math.random() * choices.length)]
}
