'use client'

interface SummaryCardProps {
  visible: boolean
  emoji: string
  A: number
  B: number
  P: number
  mode: 'merge' | 'split'
}

export default function SummaryCard({ visible, emoji, A, B, P, mode }: SummaryCardProps) {
  const isMerge = mode === 'merge'

  const title = isMerge ? `${emoji} 我发现了一个秘密！` : `${emoji} 拆开也能算！`

  const formula = isMerge
    ? `${A}×${P} + ${B}×${P} = (${A}+${B})×${P} = ${A + B}×${P} = ${(A + B) * P}`
    : `(${A}+${B})×${P} = ${A}×${P} + ${B}×${P} = ${A * P} + ${B * P} = ${(A + B) * P}`

  const insightHtml = isMerge
    ? `不管是<strong>分开算</strong>还是<strong>合起来算</strong>，花的钱都是 <strong>${(A + B) * P} 元</strong>！<br>因为每袋价钱相同，把袋数加起来再乘价钱，和分开各算再加起来，结果相同！`
    : `一大袋拆成两小份，<strong>分开算再加起来</strong>也一样！<br>合着算 = 拆开算 = <strong>${(A + B) * P} 元</strong>`

  return (
    <div
      className={`rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-pink-100 to-blue-100 p-4 text-center shadow-[0_8px_32px_rgba(251,191,36,.2)] transition-all duration-600 ${
        visible
          ? 'max-h-[400px] translate-y-0 opacity-100'
          : 'max-h-0 translate-y-4 overflow-hidden border-none p-0 opacity-0'
      }`}
    >
      <h3 className="mb-1.5 text-lg font-bold text-red-600">{title}</h3>
      <div className="mx-auto my-1.5 inline-block rounded-xl bg-white/70 px-3.5 py-2 text-xl font-bold text-slate-800">
        {formula}
      </div>
      <div
        className="mt-1.5 text-sm leading-relaxed text-slate-600"
        dangerouslySetInnerHTML={{ __html: insightHtml }}
      />
    </div>
  )
}
