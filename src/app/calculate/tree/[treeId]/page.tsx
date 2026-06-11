'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateLevelState } from '@/hooks/useCalculateLevelState'
import { getTree, SKILL_TREES } from '@/utils/calculate-trees'
import type { TreeId, LevelId, TierStatus } from '@/utils/calculate-types'
import Link from 'next/link'
import { use } from 'react'

export default function TreePage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = use(params)
  const { user } = useAuth()
  const { getTierStatus, isFullyPassed, isUnlocked } = useCalculateLevelState(user)

  const tree = getTree(treeId as TreeId)
  if (!tree) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        技能树不存在
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/calculate" className="text-white/60 hover:text-white">
          ◀
        </Link>
        <h1 className="text-lg font-bold text-white">{tree.name}</h1>
      </div>

      {tree.prerequisites.length > 0 && (
        <div className="mb-4 text-xs text-white/40">
          前置：{tree.prerequisites.map((p) => {
            const passed = isFullyPassed(p as LevelId)
            return (
              <span key={p} className={passed ? 'text-green-400' : 'text-red-400'}>
                {p} {passed ? '✓' : '✗'}{' '}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        {tree.levels.map((level, i) => {
          const unlocked = isUnlocked(level.id)
          const b = getTierStatus(level.id, 'beginner')
          const a = getTierStatus(level.id, 'advanced')
          const c = getTierStatus(level.id, 'challenge')

          return (
            <div key={level.id} className="flex w-full flex-col items-center">
              {i > 0 && <div className="h-4 w-px bg-white/20" />}
              <LevelNode
                id={level.id}
                name={level.name}
                unlocked={unlocked}
                beginner={b}
                advanced={a}
                challenge={c}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

type LevelNodeProps = {
  id: LevelId
  name: string
  unlocked: boolean
  beginner: TierStatus
  advanced: TierStatus
  challenge: TierStatus
}

function LevelNode({ id, name, unlocked, beginner, advanced, challenge }: LevelNodeProps) {
  const tierIcon = (s: TierStatus) =>
    s === 'passed' ? '✓' : s === 'practicing' ? '●' : '○'

  if (!unlocked) {
    return (
      <div className="w-full rounded-2xl bg-white/[0.04] p-4 opacity-40">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white/50">{id}</div>
            <div className="text-xs text-white/30">{name}</div>
          </div>
          <div className="text-lg text-white/20">🔒</div>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={`/calculate/level/${id}`}
      className="block w-full rounded-2xl bg-white/[0.07] p-4 transition hover:bg-white/[0.12]"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">{id}</div>
          <div className="text-xs text-white/60">{name}</div>
        </div>
        <div className="flex gap-1 text-sm">
          <span className={beginner === 'passed' ? 'text-green-400' : 'text-white/30'}>
            {tierIcon(beginner)}
          </span>
          <span className={advanced === 'passed' ? 'text-green-400' : 'text-white/30'}>
            {tierIcon(advanced)}
          </span>
          <span className={challenge === 'passed' ? 'text-green-400' : 'text-white/30'}>
            {tierIcon(challenge)}
          </span>
        </div>
      </div>
    </Link>
  )
}
