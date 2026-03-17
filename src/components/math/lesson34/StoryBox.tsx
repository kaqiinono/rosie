'use client'

import { Card } from '@/components/ui/card'

interface StoryBoxProps {
  avatar: string
  html: string
}

export default function StoryBox({ avatar, html }: StoryBoxProps) {
  return (
    <Card className="flex min-h-[60px] items-center gap-3 border-2 border-amber-400 bg-white/92 px-[18px] py-3.5 shadow-[0_4px_20px_rgba(0,0,0,.06)] [&_.price]:inline-block [&_.price]:rounded-lg [&_.price]:border [&_.price]:border-amber-400 [&_.price]:bg-amber-50 [&_.price]:px-[7px] [&_.price]:py-px [&_.price]:font-bold [&_.price]:text-amber-800 [&_strong]:text-red-600">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[26px] shadow-[0_4px_12px_rgba(251,191,36,.4)]">
        {avatar}
      </div>
      <div
        className="flex-1 text-base leading-[1.65]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Card>
  )
}
