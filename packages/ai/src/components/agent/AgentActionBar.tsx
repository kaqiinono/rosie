'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentAction } from '../../types'

type AgentActionBarProps = {
  actions: AgentAction[]
  renderMathProblem?: (problemId: string, renderRemainingActions: () => ReactNode) => ReactNode
}

export default function AgentActionBar({ actions, renderMathProblem }: AgentActionBarProps) {
  const router = useRouter()
  const [openedProblemId, setOpenedProblemId] = useState<string | null>(null)

  const remainingActions = actions.filter(
    (a) => !(a.type === 'open_problem' && a.problemId === openedProblemId),
  )

  const renderRemainingButtons = (): ReactNode => {
    const visible = remainingActions
    if (visible.length === 0) return null
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {visible.map((action, index) => (
          <button
            key={`${action.type}-${'problemId' in action ? action.problemId : index}`}
            type="button"
            onClick={() => handleClick(action)}
            className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-200"
          >
            {action.label}
          </button>
        ))}
      </div>
    )
  }

  if (openedProblemId && renderMathProblem) {
    return (
      <div className="mt-3 min-w-0 overflow-hidden">
        {renderMathProblem(openedProblemId, renderRemainingButtons)}
      </div>
    )
  }

  if (actions.length === 0) return null

  const handleClick = (action: AgentAction) => {
    if (action.type === 'open_problem' && renderMathProblem) {
      setOpenedProblemId(action.problemId)
      return
    }
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
          key={`${action.type}-${'problemId' in action ? action.problemId : index}`}
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
