'use client'

interface StoryBoxProps {
  avatar: string
  html: string
}

export default function StoryBox({ avatar, html }: StoryBoxProps) {
  return (
    <div className="shadow-sticker-sm flex min-h-[60px] items-center gap-3 rounded-2xl border-2 border-amber-400 bg-white px-[18px] py-3.5 [&_.price]:inline-block [&_.price]:rounded-lg [&_.price]:border [&_.price]:border-amber-400 [&_.price]:bg-amber-50 [&_.price]:px-[7px] [&_.price]:py-px [&_.price]:font-bold [&_.price]:text-amber-800 [&_strong]:text-red-600">
      <div className="shadow-sticker-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[26px]">
        {avatar}
      </div>
      <div className="flex-1 text-base leading-[1.65]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
