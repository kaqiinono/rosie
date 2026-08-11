'use client'

import { useRouter } from 'next/navigation'
import type { AgentAction } from '../../types'

type AgentActionBarProps = {
  actions: AgentAction[]
}

export default function AgentActionBar({ actions }: AgentActionBarProps) {
  const router = useRouter()
  if (actions.length === 0) return null

  const handleClick = (action: AgentAction) => {
    if (action.type === 'navigate' || action.type === 'open_reading') {
      router.push(action.href)
      return
    }
    if (action.type === 'open_problem') {
      router.push(`/math/sea?q=${encodeURIComponent(action.problemId)}`)
      return
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <button
          key={`${action.type}-${index}`}
          type="button"
          onClick={() => handleClick(action)}
          className="rounded-full bg-sky-100 px-3 py-1.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-200"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
