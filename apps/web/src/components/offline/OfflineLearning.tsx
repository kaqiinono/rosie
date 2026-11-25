'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@rosie/core'
import { StickerCard } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'
import { TodayPlanOverviewCards } from '@/components/today/TodayPlanOverview'
import { getOfflineOwner, OFFLINE_CHANGED, readOfflineState, updateOfflineState, type OfflineState } from '@/lib/offline/store'
import { useOfflineOwner, useOfflineSyncStatus } from './OfflineEntry'
import { CalcPractice, EnglishPractice, MathPractice, TreePractice } from './OfflinePractices'
import { useOfflineRouting } from './useOfflineRouting'

type Activity = 'calc' | 'english' | 'math' | 'tree'

export default function OfflineLearning() {
  const owner = useOfflineOwner()
  const syncStatus = useOfflineSyncStatus()
  const { user } = useAuth()
  const [saved, setSaved] = useState<{ owner: string; state?: OfflineState }>()
  const [activity, setActivity] = useState<Activity>()
  useOfflineRouting(activity ? null : 'offline')
  const state = saved?.owner === owner ? saved?.state : undefined
  const pack = state?.pack

  useEffect(() => {
    if (!owner) return
    let current = true
    const refresh = () => void readOfflineState(owner).then((state) => {
      if (current) setSaved({ owner, state })
    }).catch(() => {
      if (current) setSaved({ owner })
    })
    refresh()
    window.addEventListener(OFFLINE_CHANGED, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      current = false
      window.removeEventListener(OFFLINE_CHANGED, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [owner])

  async function change(update: (current: OfflineState) => OfflineState) {
    if (!owner || getOfflineOwner() !== owner) throw new Error('请重新打开离线学习。')
    const next = await updateOfflineState(owner, update)
    if (getOfflineOwner() === owner) setSaved({ owner, state: next })
  }

  const cards = pack?.cards.map((card) => {
    const round = pack.english
    const math = pack.math
    if (card.key === 'calc') return { ...card, subtitle: state?.calc ? '有一组可继续' :
      pack.calc ? '可以离线练习' : '策略需联网下载' }
    if (card.key === 'english') return { ...card, subtitle: round ? '已下载一轮' : card.subtitle + ' · 练习需联网' }
    if (card.key === 'math') return { ...card, subtitle: math
      ? math.questions.length + ' 题可离线' + (math.unavailable ? ' · ' + math.unavailable + ' 题需联网' : '')
      : card.subtitle + ' · 练习需联网' }
    return { ...card, subtitle: card.subtitle + ' · 练习需联网' }
  }) ?? []

  return (
    <main className="bg-kid-paper text-text-primary min-h-dvh px-4 pt-16 pb-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">离线学习</h1>
            {pack && <p className="text-text-secondary mt-1 text-sm">{pack.day} 的学习单 · 进度先保存在这台设备</p>}
          </div>
          <Button asChild variant="soft"><a href={user ? '/' : '/auth'}>{user ? '返回在线首页' : '尝试登录'}</a></Button>
        </header>
        {owner && saved?.owner !== owner ? <p role="status">正在打开本机内容…</p> :
          !pack || !state ? <StickerCard>这台设备还没有可用的离线内容。联网登录后，在首页「今日计划」点「离线同步」。</StickerCard> : <>
            {activity ? <Button className="self-start" variant="soft" onClick={() => setActivity(undefined)}>返回学习单</Button> :
              <>
                <h2 className="text-sm font-bold">今日计划</h2>
                <TodayPlanOverviewCards cards={cards} offlineActions={{
                  ...(pack.calc || state.calc ? { calc: () => setActivity('calc') } : {}),
                  ...(pack.english ? { english: () => setActivity('english') } : {}),
                  ...(pack.math?.questions.length ? { math: () => setActivity('math') } : {}),
                }} />
                <StickerCard className="flex items-center justify-between gap-4" tone="accent">
                  <div>
                    <h2 className="font-bold">🌳 生命树</h2>
                    <p className="text-text-secondary text-sm">{pack.tree ? pack.tree.tasks.length + ' 项作业已保存' : '作业需联网下载'}</p>
                  </div>
                  {pack.tree && <Button variant="soft" onClick={() => setActivity('tree')}>看作业</Button>}
                </StickerCard>
              </>}
            {activity === 'calc' && <CalcPractice state={state} change={change} />}
            {activity === 'english' && <EnglishPractice state={state} change={change} />}
            {activity === 'math' && <MathPractice state={state} change={change} />}
            {activity === 'tree' && <TreePractice state={state} change={change} />}
            <p className="text-text-secondary text-sm" aria-live="polite">
              {state.queue.length ? state.queue.length + ' 项已保存在本机 · 待同步' : '本机没有待同步记录'}
            </p>
            {state.queue.length > 0 && <p className="text-text-secondary text-sm" role="status">
              {syncStatus || (!user ? '登录原账号后可以同步。' : '')}
            </p>}
          </>}
      </div>
    </main>
  )
}
