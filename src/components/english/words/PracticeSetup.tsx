'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Rocket, Target } from 'lucide-react'

interface PracticeSetupProps {
  scopeLabel: string
  onStart: (types: ('A' | 'B' | 'C')[]) => void
}

export default function PracticeSetup({ scopeLabel, onStart }: PracticeSetupProps) {
  const [typeA, setTypeA] = useState(true)
  const [typeB, setTypeB] = useState(true)
  const [typeC, setTypeC] = useState(false)

  const handleStart = () => {
    const types: ('A' | 'B' | 'C')[] = []
    if (typeA) types.push('A')
    if (typeB) types.push('B')
    if (typeC) types.push('C')
    if (!types.length) {
      alert('请至少选一种题型！')
      return
    }
    onStart(types)
  }

  return (
    <Card className="bg-[var(--wm-surface)] border-[var(--wm-border)] mb-5">
      <CardHeader>
        <CardTitle className="font-fredoka text-[1.35rem] text-[var(--wm-accent2)] flex items-center gap-2">
          <Target className="h-5 w-5" />
          练习设置
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[.78rem] font-bold text-[var(--wm-text-dim)] min-w-[60px]">题型</span>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'A', label: 'A. 释义→选单词', checked: typeA, toggle: setTypeA },
              { key: 'B', label: 'B. 单词→选释义', checked: typeB, toggle: setTypeB },
              { key: 'C', label: 'C. 释义→默写', checked: typeC, toggle: setTypeC },
            ] as const).map(t => (
              <Button
                key={t.key}
                variant="outline"
                size="sm"
                onClick={() => t.toggle(!t.checked)}
                className={cn(
                  'gap-1.5 border-2 text-[.8rem] font-bold select-none',
                  t.checked
                    ? 'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)] hover:bg-[rgba(233,69,96,.2)]'
                    : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)]'
                )}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[.78rem] text-[var(--wm-text-dim)]">
            范围：<Badge variant="orange" className="text-[var(--wm-accent2)] font-extrabold bg-transparent border-0 px-0">{scopeLabel}</Badge>
          </span>
        </div>

        <Button
          onClick={handleStart}
          variant="gradient"
          size="lg"
          className="bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] font-nunito font-extrabold text-[.95rem] shadow-[0_4px_14px_rgba(233,69,96,.35)] hover:shadow-[0_6px_18px_rgba(233,69,96,.5)] w-fit"
        >
          <Rocket className="h-4 w-4" />
          开始练习
        </Button>
      </CardContent>
    </Card>
  )
}
