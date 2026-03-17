'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Problem } from '@/utils/type'
import { TAG_STYLE } from '@/utils/lesson35-data'

interface ProblemListProps {
  problems: Problem[]
  solved: Record<string, boolean>
  basePath: string
  showSource?: boolean
  sourceLabel?: string
}

export default function ProblemList({ problems, solved, basePath, showSource, sourceLabel }: ProblemListProps) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p, i) => {
        const done = solved[p.id]
        return (
          <Link
            key={p.id}
            href={`${basePath}/${i + 1}`}
            className={`flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] ${
              done ? 'border-app-green' : 'border-transparent hover:border-border-light'
            }`}
          >
            <div
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-app-green-light text-app-green-dark' : 'bg-app-blue-light text-app-blue-dark'
              }`}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text-primary">{p.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                <span
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`/math/ny/35/alltest?type=${p.tag}`)
                  }}
                  className={`inline-flex cursor-pointer items-center rounded-full px-2 py-px text-[10px] font-semibold ${TAG_STYLE[p.tag] || 'bg-gray-100 text-gray-600'}`}
                  title={`查看所有${p.tagLabel}题目`}
                >
                  {p.tagLabel} 🔍
                </span>
                {showSource && sourceLabel && (
                  <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
                    {sourceLabel}
                  </span>
                )}
              </div>
            </div>
            {done ? (
              <div className="shrink-0 text-lg text-app-green">✅</div>
            ) : (
              <div className="shrink-0 text-xl text-text-muted">›</div>
            )}
          </Link>
        )
      })}
      {problems.length === 0 && (
        <div className="col-span-full py-6 text-center text-[13px] text-text-muted">
          没有符合筛选条件的题目
        </div>
      )}
    </div>
  )
}
