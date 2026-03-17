'use client'

import { PHONICS_LEGEND } from '@/utils/phonics'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Palette } from 'lucide-react'

export default function PhonicsLegend() {
  return (
    <Card className="bg-[var(--wm-surface)] border-[var(--wm-border)] mb-4">
      <CardContent className="px-4 py-3">
        <div className="text-[.68rem] font-extrabold text-[var(--wm-text-dim)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Palette className="h-3 w-3" />
          自然拼读颜色图例（单词级别生效）
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {PHONICS_LEGEND.map(item => (
            <Badge
              key={item.cls}
              variant="secondary"
              className="bg-transparent border-0 px-0 py-0 text-[.7rem] font-bold gap-1"
            >
              <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: item.color }} />
              <span className={item.cls}>{item.label}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
