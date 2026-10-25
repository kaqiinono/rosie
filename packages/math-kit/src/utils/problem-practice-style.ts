const UNPRACTICED = {
  accent: 'bg-amber-200',
  surface: 'bg-amber-50/70',
  border: 'border-amber-200',
}

const PRACTICED = {
  accent: 'bg-emerald-200',
  surface: 'bg-emerald-50/70',
  border: 'border-emerald-200',
}

/** Card color records participation, not difficulty or correctness. */
export function problemPracticeStyle(count: number) {
  return count > 0 ? PRACTICED : UNPRACTICED
}
