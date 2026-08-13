'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import { compareStages, useWordData, useWordMastery, wordKey } from '@rosie/english'

type StageProgress = {
  stage: string
  practiced: number
  total: number
}

export default function EnglishStatsPanel() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const requestUser = expanded ? user : null
  const { vocab, isLoading: isVocabLoading } = useWordData(requestUser)
  const { masteryMap, isLoading: isMasteryLoading } = useWordMastery(requestUser)
  const isLoading = isVocabLoading || isMasteryLoading

  const progress = useMemo((): StageProgress[] => {
    const wordsByStage = new Map<string, Set<string>>()

    for (const entry of vocab) {
      const stage = entry.stage?.trim()
      if (!stage) continue
      const keys = wordsByStage.get(stage) ?? new Set<string>()
      keys.add(wordKey(entry))
      wordsByStage.set(stage, keys)
    }

    return [...wordsByStage.entries()]
      .sort(([a], [b]) => compareStages(a, b))
      .map(([stage, keys]) => ({
        stage,
        total: keys.size,
        practiced: [...keys].filter((key) => {
          const mastery = masteryMap[key]
          return Boolean(
            mastery && ((mastery.correct ?? 0) + (mastery.incorrect ?? 0) > 0 || mastery.lastSeen),
          )
        }).length,
      }))
  }, [vocab, masteryMap])

  if (!user) return null

  return (
    <section className="w-full max-w-[840px]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:border-emerald-200 hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none" aria-hidden>
            📊
          </span>
          <span className="text-text-primary text-[13px] font-extrabold tracking-wide">
            学习概览
          </span>
          {!expanded && (
            <span className="text-text-muted truncate text-[11px] font-semibold">
              点击展开查看各词库进度
            </span>
          )}
          {expanded && isLoading && (
            <span className="text-text-muted text-[11px] font-semibold">同步中…</span>
          )}
        </span>
        <span
          className={`text-text-muted shrink-0 text-xs font-bold transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 px-4 py-6 text-center text-xs font-semibold text-emerald-700">
              正在加载词库进度…
            </div>
          ) : progress.length > 0 ? (
            progress.map((item) => (
              <div
                key={item.stage}
                className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 p-3.5"
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-lg leading-none" aria-hidden>
                    📖
                  </span>
                  <span className="text-[11px] font-extrabold tracking-wide text-emerald-700">
                    {item.stage} 词库
                  </span>
                </div>
                <div className="font-fredoka text-[clamp(22px,4vw,28px)] leading-none font-black text-emerald-700 tabular-nums">
                  {item.practiced}/{item.total}
                </div>
                <div className="text-text-muted mt-1.5 text-[10px] leading-snug font-semibold">
                  已练习 / 总单词
                </div>
              </div>
            ))
          ) : (
            <div className="text-text-muted col-span-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-6 text-center text-xs font-semibold">
              暂无词库数据
            </div>
          )}
        </div>
      )}
    </section>
  )
}
