'use client'

import Link from 'next/link'
import { POEMS } from '../../utils/grade1-down'
import type { PoemEntry } from '../../utils/grade1-down/types'

interface PoemListProps {
  basePath?: string
  poems?: PoemEntry[]
}

export default function PoemList({ basePath = '/chinese/poems', poems = POEMS }: PoemListProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {poems.map((poem) => (
        <li key={poem.id}>
          <Link
            href={`${basePath}/${poem.id}`}
            className="block rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-violet-900">{poem.title}</h3>
                <p className="mt-0.5 text-xs text-violet-600/80">
                  {poem.dynasty} · {poem.author}
                </p>
              </div>
              {poem.requiresRecite && (
                <span className="shrink-0 rounded-full bg-violet-200/80 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                  必背
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {poem.lines.join('')}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
