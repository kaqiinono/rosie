'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MathFormulaProps {
  mode: 'merge' | 'split'
  step: number
  A: number
  B: number
  P: number
}

export default function MathFormula({ mode, step, A, B, P }: MathFormulaProps) {
  const isMerge = mode === 'merge'

  const showRow1 = isMerge ? step >= 3 : step >= 4
  const showCalc1 = isMerge ? step >= 3 : step >= 5
  const showBridge = isMerge ? step >= 5 : step >= 4
  const showRow2 = isMerge ? step >= 5 : step >= 2
  const showCalc2 = isMerge ? step >= 6 : step >= 2

  return (
    <Card className="border-2 border-violet-300 bg-white/92 px-4 py-3.5 text-center shadow-[0_4px_20px_rgba(0,0,0,.06)]">
      {/* Row 1: Split formula */}
      <div
        className={cn(
          'my-1 flex flex-wrap items-center justify-center gap-[5px] text-lg font-bold transition-all duration-500',
          showRow1 ? 'h-auto translate-y-0 opacity-100' : 'h-0 translate-y-2 overflow-hidden opacity-0'
        )}
      >
        <Badge variant="blue" className="gap-[3px] border-2 border-blue-300 px-2.5 py-[3px] text-lg font-bold">
          {A} × {P}
        </Badge>
        <span className="text-lg font-bold text-slate-500">+</span>
        <Badge variant="rose" className="gap-[3px] border-2 border-pink-300 px-2.5 py-[3px] text-lg font-bold">
          {B} × {P}
        </Badge>
      </div>

      {/* Calc detail 1 */}
      <div
        className={cn(
          'my-[3px] flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-500 transition-all duration-500',
          showCalc1 ? 'h-auto opacity-100' : 'h-0 overflow-hidden opacity-0'
        )}
      >
        <span>= <strong className="text-slate-800">{A * P}元</strong></span>
        <span>+</span>
        <span><strong className="text-slate-800">{B * P}元</strong></span>
        <span>=</span>
        <span><strong className="text-slate-800">{(A + B) * P}元</strong></span>
      </div>

      {/* Equals bridge */}
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 py-0.5 transition-all duration-500',
          showBridge ? 'h-auto opacity-100' : 'h-0 overflow-hidden opacity-0'
        )}
      >
        <Badge variant="green" className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-emerald-300 p-0 text-xl font-black">
          =
        </Badge>
        <span className="text-xs font-semibold text-emerald-600">钱一样多！</span>
        <Badge variant="green" className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-emerald-300 p-0 text-xl font-black">
          =
        </Badge>
      </div>

      {/* Row 2: Merged formula */}
      <div
        className={cn(
          'my-1 flex flex-wrap items-center justify-center gap-[5px] text-lg font-bold transition-all duration-500',
          showRow2 ? 'h-auto translate-y-0 opacity-100' : 'h-0 translate-y-2 overflow-hidden opacity-0'
        )}
      >
        <Badge variant="green" className="gap-[3px] border-2 border-emerald-300 px-2.5 py-[3px] text-lg font-bold">
          ( {A} + {B} )
        </Badge>
        <span className="text-lg font-bold text-slate-500">×</span>
        <Badge variant="green" className="gap-[3px] border-2 border-emerald-300 px-2.5 py-[3px] text-lg font-bold">
          {P}
        </Badge>
      </div>

      {/* Calc detail 2 */}
      <div
        className={cn(
          'my-[3px] flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-500 transition-all duration-500',
          showCalc2 ? 'h-auto opacity-100' : 'h-0 overflow-hidden opacity-0'
        )}
      >
        <span>= <strong className="text-slate-800">{A + B} × {P}</strong></span>
        <span>=</span>
        <span><strong className="text-slate-800">{(A + B) * P}元</strong></span>
      </div>
    </Card>
  )
}
