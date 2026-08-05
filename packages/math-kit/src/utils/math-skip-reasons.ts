/** Reasons for skipping a problem during immersive practice. */
export type MathSkipReason = 'cant' | 'later' | 'already' | 'other'

export type MathSkipEntry = {
  reason: MathSkipReason
  note?: string
  addedAt: string
}

export const MATH_SKIP_REASON_OPTIONS: { key: MathSkipReason; label: string }[] = [
  { key: 'cant', label: '不会' },
  { key: 'later', label: '稍后再做' },
  { key: 'already', label: '会做了' },
  { key: 'other', label: '其他' },
]

export function mathSkipReasonLabel(reason: MathSkipReason): string {
  return MATH_SKIP_REASON_OPTIONS.find((o) => o.key === reason)?.label ?? reason
}

export function isMathSkipReason(value: string): value is MathSkipReason {
  return MATH_SKIP_REASON_OPTIONS.some((o) => o.key === value)
}
