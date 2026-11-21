'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { useLocalStorage } from '@rosie/core'
import { AppDialog, Gift, LearningIcon, StickerCard, Sun } from '@rosie/ui'
import { Badge, Button, Flex, IconButton, Text, TextField, Theme } from '@rosie/ui/themes'
import TreeScene, { type ItemKind, type TreeSceneHandle } from '@/components/tree-demo/garden/TreeScene'
import WiltBin from '@/components/tree-demo/garden/WiltBin'
import Sky, { daypartOf } from '@/components/tree-demo/garden/Sky'
import type { BubbleState } from '@/components/tree-demo/garden/Bubbles'
import ScatteredBubbles from './ScatteredBubbles'
import StonePanel, { Gem } from '@/components/tree-demo/garden/StonePanel'
import { buildRegions, todayCenter, type Region } from '@/components/tree-demo/garden/layout'
import { bubbleSubject, CORE_SUBJECTS, CROWN_BUBBLE_BURST_COLOR, SUBJECTS, type Apple, type CoreSubject, type SubjectKey } from '@/components/tree-demo/garden/model'
import { GardenFx } from '@/components/tree-demo/garden/fx'
import { SUN_MAGIC_COST, canGrowWithSun, dayOf, isInstantHomework, isMustDo, lifeWishThreshold, shift, timing, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { DiaryDialog } from '@/components/tree-demo/garden/GardenDialogs'
import { blindBoxChances, isEarly, tomatoPrices, tomatoWallet } from '@/lib/time-tree/rewards'
import { dayPlanMinutes, weeklyHomeworkStart } from '@/lib/time-tree/flowers'
import { cycleAvailableFrom, cycleBubbleIds, cycleHomeworkProgress, homeworkCycleKey } from '@/lib/time-tree/cycleHomework'
import { sceneState } from './sceneState'
import { finishAndPop } from './finishStep'
import { StepPanel, TreeWait } from './StepPanel'
import { useFlowerRewardToast } from './useFlowerRewardToast'
import DailyRainbowReward from './DailyRainbowReward'
import BlindBoxDrawer from './BlindBoxDrawer'
import DayTasksDialog from './DayTasksDialog'
import { treeDates, useTimeTree, useTreeHistory } from './useTimeTree'
import { MinimizeTimeTreeButton } from './TimeTreeLauncher'
import '@/components/tree-demo/garden/garden.css'

function bump(el: HTMLElement | null): void {
  if (!el) return
  el.classList.remove('tg-bump')
  void el.offsetWidth
  el.classList.add('tg-bump')
}

const PILE_COLOR = { chinese: 'red', math: 'amber', english: 'blue' } as const

function isCoreSubject(color: SubjectKey): color is CoreSubject {
  return color === 'chinese' || color === 'math' || color === 'english'
}

function TomatoExchangeRow({ icon, title, cost, children }: {
  icon: ReactNode
  title: string
  cost: number
  children: ReactNode
}) {
  return (
    <StickerCard as="li" tone="accent" variant="dashed" elevation="flat" className="flex items-center gap-3">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center text-2xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <Text as="p" size="3" weight="bold" className="break-words">{title}</Text>
        <Text as="p" size="2" color="gray">需要 🍅 {cost} 颗番茄</Text>
      </div>
      {children}
    </StickerCard>
  )
}

const statusQuery = '(min-width: 48rem)'
function subscribeStatusLayout(update: () => void) {
  const media = window.matchMedia(statusQuery)
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
const inlineStatus = () => window.matchMedia(statusQuery).matches
const serverStatus = () => true

interface StatusContentProps {
  mustCount: number
  mustDone: number
  streak: number
  sun: number
  water: number
  laterCount: number
  sunRef: RefObject<HTMLSpanElement | null>
  waterRef: RefObject<HTMLSpanElement | null>
  tomatoControl: ReactNode
  onDiary: () => void
  onLater: () => void
}

function TreeStatusContent({
  mustCount,
  mustDone,
  streak,
  sun,
  water,
  laterCount,
  sunRef,
  waterRef,
  tomatoControl,
  onDiary,
  onLater,
}: StatusContentProps) {
  return (
    <Flex gap="2" align="center" wrap="wrap" className="whitespace-nowrap">
      <Badge color="pink" variant="soft" radius="full">
        {mustCount ? `🎯 ${mustDone}/${mustCount}` : '🎯 没有必做'}
      </Badge>
      <Badge color="orange" variant="soft" radius="full">
        🔥 {streak} 天
      </Badge>
      <Badge ref={sunRef} color="amber">
        ☀️ {sun}
      </Badge>
      <Badge ref={waterRef} color="sky">
        💧 {water}
      </Badge>
      {tomatoControl}
      <Button size="1" variant="soft" onClick={onDiary}>
        📔 日记
      </Button>
      {laterCount > 0 && (
        <Button size="1" variant="soft" onClick={onLater}>
          更后面 {laterCount}
        </Button>
      )}
      <Button asChild size="1" variant="soft">
        <Link href="/setting/time-tree">家长设置</Link>
      </Button>
    </Flex>
  )
}

function GroupedSteps({
  steps,
  empty,
  onSelect,
  descending = false,
}: {
  steps: WorkStep[]
  empty: string
  onSelect: (id: string) => void
  descending?: boolean
}) {
  const groups = new Map<string, WorkStep[]>()
  for (const step of steps) {
    const day = step.planned ?? step.scheduled
    const group = groups.get(day)
    if (group) group.push(step)
    else groups.set(day, [step])
  }
  if (!groups.size) return <Text>{empty}</Text>

  return (
    <Flex direction="column" gap="4">
      {Array.from(groups.keys()).sort((a, b) => descending ? b.localeCompare(a) : a.localeCompare(b)).map((day) => {
        const date = new Date(day + 'T00:00:00Z')
        const label = `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 · 周${'日一二三四五六'[date.getUTCDay()]}`
        return (
          <section key={day}>
            <h3 className="mb-2 font-bold">
              <time dateTime={day}>{label}</time>
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.get(day)?.map((step) => {
                const subject = bubbleSubject(step)
                const durationLabel = `${weeklyHomeworkStart(step) ? '周目标' : '预计'} ${step.minutes} 分钟`
                return (
                  <StickerCard key={step.id} asChild interactive tone="paper" size="sm" elevation="sm" radius="md">
                    {/* native-ok: 多行作业卡通过 StickerCard 提供外观，按钮提供整卡键盘操作。 */}
                    <button type="button" onClick={() => onSelect(step.id)} aria-label={`${label}，${step.name}，${subject.label}，${durationLabel}`}>
                      <span className="flex items-center gap-3 text-left">
                        <span aria-hidden="true" className="text-2xl">{step.crown ? <LearningIcon name="crown" size={24} /> : subject.emoji}</span>
                        <span className="min-w-0">
                          <Text as="span" size="3" weight="bold" className="block break-words">{step.name}</Text>
                          <Text as="span" size="2" color="gray">{subject.label} · {durationLabel}</Text>
                        </span>
                      </span>
                    </button>
                  </StickerCard>
                )
              })}
            </div>
          </section>
        )
      })}
    </Flex>
  )
}

export default function LiveTree() {
  const api = useTimeTree()
  const flowerReward = useFlowerRewardToast('top')
  const [casting, setCasting] = useState(false)
  const { tree, busy, run } = api
  const [stepId, setStep] = useState<string | null>(null)
  const desktop = useSyncExternalStore(subscribeStatusLayout, inlineStatus, serverStatus)
  const [packedPreference, setPackedPreference] = useLocalStorage<boolean | null>('rosie:time-tree:panels-packed', null)
  const panelsPacked = packedPreference ?? !desktop
  const [taskDays, setTaskDays] = useState<string[] | null>(null)
  const [dialog, show] = useState<'' | 'wilt' | 'later' | 'diary' | 'box' | 'wish' | 'flower' | 'fruitList' | 'tomato'>('')
  const [diaryPage, setDiaryPage] = useState(0)
  const diaryThrough = tree && shift(tree.today, -30 * diaryPage)
  const diaryFrom = diaryThrough && shift(diaryThrough, -29)
  const history = useTreeHistory(api, dialog === 'diary' && diaryFrom && diaryThrough
    ? treeDates(diaryFrom, diaryThrough) : taskDays ?? [])
  const [rainbowAt, setRainbowAt] = useState<{ id: string; x: number; y: number } | null>(null)
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([])
  const [itemId, setItem] = useState('')
  const [pin, setPin] = useState('')
  const [notice, notify] = useState('')
  const sceneNotice = notice || (api.messageCode === 'stale_revision' ? '' : api.message)
  const [rewardStep, setRewardStep] = useState<WorkStep | null>(null)
  const [savingBubble, setSavingBubble] = useState<string | null>(null)
  const [burstIds, setBurstIds] = useState<ReadonlySet<string>>(() => new Set())
  const completingBubble = useRef(false)
  const bloomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [skyNow, setSkyNow] = useState(Date.now)
  const skyTime = new Date(skyNow + api.clockOffsetMs)
  const skyDay = dayOf(skyTime)
  const hour = Number(skyTime.toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }))
  const [fresh, setFresh] = useState<Record<string, 'born'>>({})
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const fx = useRef<GardenFx | null>(null)
  const treeRef = useRef<TreeSceneHandle>(null)
  const sunRef = useRef<HTMLSpanElement>(null)
  const waterRef = useRef<HTMLSpanElement>(null)
  const chestRef = useRef<HTMLButtonElement>(null)
  const packing = useRef<Animation[] | null>(null)
  const piles = useRef<Partial<Record<SubjectKey, HTMLElement | null>>>({})
  const picking = useRef(new Set<string>())
  const popping = useRef(new Set<string>())
  const boxTimer = useRef<number | null>(null)
  const floatSeq = useRef(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const rail = useRef<HTMLElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const state = useMemo(() => (tree ? sceneState(tree) : null), [tree])
  const previousRegions = useRef<Region[]>([])
  const regions = useMemo(() => {
    if (!state || !tree) return []
    const byDay = new Map<string, { completed: number; total: number }>()
    for (const step of tree.steps) {
      if (!step.planned || step.skipped) continue
      const minutes = byDay.get(step.planned) ?? { completed: 0, total: 0 }
      const estimated = dayPlanMinutes(step)
      minutes.total += estimated
      if (step.end) minutes.completed += estimated
      byDay.set(step.planned, minutes)
    }
    for (const [day, minutes] of Object.entries(api.historyMinutes ?? {})) byDay.set(day, minutes)
    return buildRegions(state, true, previousRegions.current).map((region) => {
      if (region.dateKey) {
        return { ...region, plannedMinutes: byDay.get(region.dateKey) ?? { completed: 0, total: 0 } }
      }
      const total = region.mergedKeys.reduce((sum, day) => sum + (byDay.get(day)?.total ?? 0), 0)
      return { ...region, plannedMinutes: { completed: 0, total } }
    })
  }, [state, tree, api.historyMinutes])
  useEffect(() => { previousRegions.current = regions }, [regions])
  const ready = !!tree
  // Keep the final keyframes until React hides the panels, then release them before paint.
  useLayoutEffect(() => () => {
    packing.current?.forEach(animation => animation.cancel())
    packing.current = null
  }, [panelsPacked, ready])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      const now = Date.now()
      setSkyNow(now)
      const corrected = now + api.clockOffsetMs
      const midnight = Date.parse(`${shift(dayOf(new Date(corrected)), 1)}T00:00:00+08:00`)
      timer = setTimeout(update, Math.max(1, Math.min(60000, midnight - corrected)))
    }
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [api.clockOffsetMs])
  useEffect(() => {
    if (!ready || !canvas.current || !rail.current) return
    const effects = new GardenFx()
    effects.attach(canvas.current, () => null)
    fx.current = effects
    const obs = new ResizeObserver(() => {
      // 窄屏只为合并面板的实际高度留位，宽屏释放整个底部。
      scene.current?.style.setProperty('--tg-rail-h', (rail.current?.offsetHeight ?? 0) + 'px')
      effects.resize()
    })
    if (rail.current) obs.observe(rail.current)
    if (scene.current) obs.observe(scene.current)
    return () => {
      obs.disconnect()
      effects.detach()
      fx.current = null
      if (bloomTimer.current) clearTimeout(bloomTimer.current)
    }
  }, [ready])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => notify(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  const celebrated = useRef<{ goal: string | null; day: string | null; rainbow: string | null } | null>(null)
  useEffect(() => {
    if (!tree) return
    const goal = tree.goalAwardedOn ?? null
    const day = tree.lastDoneDay ?? null
    const rainbow = tree.dailyRainbowDay ?? null
    const previous = celebrated.current
    celebrated.current = { goal, day, rainbow }
    if (!previous) return
    const parts: string[] = []
    if (rainbow === skyDay && previous.rainbow !== rainbow) {
      parts.push('🌈 今天的学习任务全部完成，收获彩虹果！')
      const prize = [...tree.apples].reverse().find(apple => apple.kind === 'rainbow' && apple.dateKey === skyDay)
      if (prize) setFresh(current => ({ ...current, [prize.id]: 'born' }))
      const bounds = scene.current?.getBoundingClientRect()
      if (bounds && fx.current && !fx.current.prefersReducedMotion()) {
        fx.current.confetti(bounds.left + bounds.width * 0.3, bounds.top + bounds.height * 0.35)
        fx.current.confetti(bounds.left + bounds.width * 0.7, bounds.top + bounds.height * 0.35)
      }
    }
    if (goal === tree.today && previous.goal !== goal) parts.push('今日目标达成，💧+2')
    if ((tree.streak ?? 0) > 1 && previous.day !== day) parts.push(`连续 ${tree.streak} 天`)
    if (parts.length) notify((current) => [current, ...parts].filter(Boolean).join(' · '))
  }, [tree, notify, skyDay])
  useEffect(() => {
    return () => {
      if (boxTimer.current !== null) window.clearTimeout(boxTimer.current)
    }
  }, [])
  useEffect(() => {
    if (!rainbowAt) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setRainbowAt(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rainbowAt])
  if (!tree || !state)
    return (
      <main className="flex min-h-dvh flex-col">
        <TreeWait api={api} />
      </main>
    )
  const cycles = cycleHomeworkProgress(tree.steps)
  const cycleIds = cycleBubbleIds(tree, cycles)
  const air = tree.steps.filter((s) => s.slot !== null && (!homeworkCycleKey(s) || cycleIds.has(s.id)))
  const today = tree.today
  const must = tree.steps.filter((s) => s.planned === tree.today && !s.skipped && isMustDo(s.priority) && !weeklyHomeworkStart(s))
  const mustDone = must.filter((s) => s.end).length
  const wilted = tree.steps.filter((s) => !homeworkCycleKey(s) && s.subject !== 'life' && !s.skipped && !s.end && !!s.planned && s.planned < tree.today)
  const horizon = shift(tree.today, 6)
  const laterSteps = tree.steps.filter((s) => !s.skipped && !s.end && !!s.planned && s.planned > horizon)
  const states: Record<string, BubbleState> = Object.fromEntries(
    air.map((s): [string, BubbleState] => [
      s.id,
      s.end
        ? 'done'
        : s.start
          ? 'running'
          : !homeworkCycleKey(s) && s.planned && s.planned < tree.today
            ? 'overdue'
            : 'ready',
    ]),
  )
  const airById = new Map(air.map(step => [step.id, step]))
  const bubbles = state.buds.flatMap(bud => {
    const step = airById.get(bud.id)
    if (!step) return []
    const key = homeworkCycleKey(step)
    const progress = key && cycles.get(key)
    if (!progress) return [bud]
    const next = !step.start && !step.end && cycleAvailableFrom(step)
    const date = next && next > today && next <= step.deadline ? ` · ${next.slice(5).replace('-', '/')} 可做` : ''
    return [{ ...bud, cycleLabel: `${progress.done}/${progress.total} 次${date}` }]
  })
  const savingIds = new Set(savingBubble ? [savingBubble] : [])
  const hiddenTreeItems = new Set(hidden)
  for (const id of burstIds) hiddenTreeItems.add(id)
  const step = (history.tree ?? tree).steps.find((s) => s.id === stepId)
  const flower = tree.steps.find((s) => s.id === itemId.split('#')[0])
  const lastWish = tree.exchanges.at(-1)
  const nextWish = lastWish && shift(lastWish, 7)
  const lifeThreshold = lifeWishThreshold(tree.rules)
  const canExchange =
    (!nextWish || tree.today >= nextWish) &&
    CORE_SUBJECTS.every((k) => tree.stones[k] >= tree.rules.wish) &&
    tree.stones.life >= lifeThreshold
  const close = () => {
    show('')
    setPin('')
  }
  const wallet = tomatoWallet(tree)
  const tomatoBalance = wallet.earned - wallet.spent
  const prices = tomatoPrices(tree.rules)
  const boxChances = blindBoxChances(tree).total
  const tomatoControl = (
    <Button size="1" color="tomato" variant="soft" aria-label={`番茄兑换，可用 ${tomatoBalance} 颗`}
      onClick={() => {
        notify('')
        show('tomato')
      }}>
      🍅 {tomatoBalance}
    </Button>
  )
  const status = (
    <StickerCard id="tree-status-panel" hidden={panelsPacked} className="tg-status-panel" size="sm" tone="paper">
      <TreeStatusContent
        mustCount={must.length}
        mustDone={mustDone}
        streak={tree.streak ?? 0}
        sun={tree.sun}
        water={tree.water}
        laterCount={laterSteps.length}
        sunRef={sunRef}
        waterRef={waterRef}
        tomatoControl={tomatoControl}
        onDiary={() => show('diary')}
        onLater={() => show('later')}
      />
    </StickerCard>
  )

  async function togglePanels() {
    if (packing.current) return
    const chest = chestRef.current
    if (panelsPacked) {
      setPackedPreference(false)
      return
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!chest || typeof chest.animate !== 'function' || reduceMotion.matches) {
      setPackedPreference(true)
      return
    }
    const target = chest.getBoundingClientRect()
    const panels = scene.current?.querySelectorAll<HTMLElement>('header .tg-status-panel, .tg-stone-rail')
    const animations = Array.from(panels ?? [], panel => {
      const rect = panel.getBoundingClientRect()
      const dx = target.left + target.width / 2 - rect.left - rect.width / 2
      const dy = target.top + target.height / 2 - rect.top - rect.height / 2
      return panel.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 },
      ], { duration: 260, easing: 'ease-in-out', fill: 'forwards' })
    })
    packing.current = animations
    const finish = () => animations.forEach(animation => animation.finish())
    window.addEventListener('resize', finish, { once: true })
    reduceMotion.addEventListener('change', finish, { once: true })
    try {
      await Promise.allSettled(animations.map(animation => animation.finished))
      if (packing.current === animations) setPackedPreference(true)
    } finally {
      window.removeEventListener('resize', finish)
      reduceMotion.removeEventListener('change', finish)
    }
  }

  function bubbleCenter(id: string): { x: number; y: number } | null {
    const el = scene.current?.querySelector<HTMLElement>(`[data-bubble-id="${id}"]`)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  function showFlower(id: string) {
    setHidden((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setFresh((prev) => ({ ...prev, [id]: 'born' }))
  }
  function flyCount(from: { x: number; y: number }, el: HTMLElement | null, color: string, dy: number) {
    const target = el?.getClientRects().length ? el : chestRef.current
    if (!target || !fx.current) return
    const box = target.getBoundingClientRect()
    fx.current.orb(
      from.x,
      from.y + dy,
      box.left + box.width / 2,
      box.top + box.height / 2,
      color,
      7,
      0.85,
      () => bump(target),
    )
  }
  function burstAt(step: WorkStep, point: { x: number; y: number } | null) {
    const effects = fx.current
    if (point && effects && !effects.prefersReducedMotion())
      effects.burst(point.x, point.y, step.crown ? CROWN_BUBBLE_BURST_COLOR : SUBJECTS[step.subject].color)
  }
  function beginPop(step: WorkStep) {
    const origin = bubbleCenter(step.id)
    popping.current.add(step.id)
    setBurstIds(new Set(popping.current))
    burstAt(step, origin)
    return origin
  }
  function endPop(id: string) {
    popping.current.delete(id)
    setBurstIds(new Set(popping.current))
  }
  function sow(
    step: WorkStep,
    treeData: TreeData,
    rewards: boolean,
    origin: { x: number; y: number } | null = null,
    onBloomed?: () => void,
    alreadyBurst = false,
  ) {
    const from = bubbleCenter(step.id) ?? origin
    const ids = step.settled ? [] : step.stages.map((_, index) => `${step.id}#${index}`)
    const effects = fx.current
    if (!from || !effects) {
      if (ids.length) {
        for (const id of ids) showFlower(id)
      }
      onBloomed?.()
      return
    }
    const reduced = effects.prefersReducedMotion()
    if (!reduced) {
      if (!alreadyBurst) burstAt(step, from)
      if (rewards && step.sun > 0) flyCount(from, sunRef.current, '#ffd54a', 0)
      if (rewards && step.water > 0) flyCount(from, waterRef.current, '#74c0fc', 12)
      if (ids.length) {
        setHidden((prev) => {
          const next = new Set(prev)
          for (const id of ids) next.add(id)
          return next
        })
      }
    }
    const regions = buildRegions(sceneState(treeData), true, previousRegions.current)
    const seeds = ids.map((id) => {
      for (const region of regions) {
        const hit = region.placed.find((item) => item.item.id === id)
        if (!hit) continue
        const at = treeRef.current?.toClient(hit.x, hit.y)
        if (at) return { id, x: at.x, y: at.y }
      }
      const center = todayCenter()
      const at = treeRef.current?.toClient(center.x, center.y)
      return { id, x: at?.x ?? from.x, y: at?.y ?? from.y - 160 }
    })
    let remaining = seeds.length
    if (!remaining) onBloomed?.()
    effects.flySeeds(from.x, from.y, seeds, (seed) => {
      showFlower(seed.id)
      remaining -= 1
      if (remaining || !onBloomed) return
      if (effects.prefersReducedMotion()) onBloomed()
      // tg-born lasts 750ms; wait for the last flower to finish opening.
      else bloomTimer.current = setTimeout(onBloomed, 750)
    })
  }
  async function clickBubble(id: string) {
    const s = air.find((x) => x.id === id)
    if (!s) return
    if (s.subject !== 'life' && !s.end && (s.start || !isInstantHomework(s) ||
      (homeworkCycleKey(s) && cycleAvailableFrom(s) > today))) {
      setStep(id)
      return
    }
    if (s.subject !== 'life' && s.end) {
      await completeRunning(id)
      return
    }
    if (popping.current.has(id)) return
    const origin = beginPop(s)
    try {
      const result = await run({ kind: 'pop', id })
      const done = result?.steps.find(item => item.id === id)
      if (!result || !done?.end || !done.popped) {
        notify('暂时无法确认这颗泡泡已开花，请查看后再试。')
        return
      }
      sow(done, result, isInstantHomework(s), origin, undefined, true)
      flowerReward.showReward(done)
    } finally {
      endPop(id)
    }
  }
  async function completeRunning(id: string) {
    if ((busy && api.startingStepId !== id) || completingBubble.current) return
    const step = air.find((item) => item.id === id)
    if (!step || (!step.start && !step.end)) return
    if (step.flowers && !step.end) { setStep(id); return }
    completingBubble.current = true
    setSavingBubble(id)
    const origin = beginPop(step)
    const release = () => {
      completingBubble.current = false
      setSavingBubble(null)
    }
    try {
      // A previous finish may have succeeded while pop failed: retry only pop.
      const popped = step.end ? await run({ kind: 'pop', id }) : null
      const outcome = step.end
        ? popped ? { ok: true as const, step: popped.steps.find(item => item.id === id) ?? step, tree: popped, bloom: true } : { ok: false as const, finished: true }
        : await finishAndPop(run, step)
      if (!outcome.ok) {
        notify(outcome.finished ? '完成已保存，开花没成功，请再点一次泡泡。' : '没保存成功，请再点一次泡泡。')
        release()
        return
      }
      flowerReward.showReward(outcome.step)
      if (outcome.bloom) sow(outcome.step, outcome.tree, true, origin, release, true)
      else release()
    } catch {
      release()
      notify('操作未完成，请查看泡泡状态后重试。')
    } finally {
      endPop(id)
    }
  }
  function scenePoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = scene.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }
  function applePoint(id: string, rect?: DOMRect): { x: number; y: number } {
    if (rect && rect.width > 0) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    for (const region of regions) {
      const hit = region.placed.find((item) => item.item.id === id)
      if (!hit) continue
      const at = treeRef.current?.toClient(hit.x, hit.y)
      if (at) return at
    }
    const apple = tree?.apples.find((item) => item.id === id)
    const region = apple && regions.find((item) => item.dateKey === apple.dateKey || item.mergedKeys.includes(apple.dateKey))
    if (region) {
      const at = treeRef.current?.toClient(region.geom.cx, region.geom.cy)
      if (at) return at
    }
    const center = todayCenter()
    return treeRef.current?.toClient(center.x, center.y) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.42 }
  }
  function addFloat(x: number, y: number, text: string, color: string): void {
    const at = scenePoint(x, y - 28)
    const id = ++floatSeq.current
    setFloats((prev) => [...prev, { id, x: at.x, y: at.y, text, color }])
    window.setTimeout(() => setFloats((prev) => prev.filter((item) => item.id !== id)), 1200)
  }
  function releaseItem(id: string): void {
    setHidden((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
  function rainbowChooserStyle(at: { x: number; y: number }): { left: number; top: number; transform: string } {
    const local = scenePoint(at.x, at.y)
    const width = scene.current?.clientWidth ?? 360
    const height = scene.current?.clientHeight ?? 640
    const left = Math.min(Math.max(local.x, 132), Math.max(132, width - 132))
    const below = local.y < 150
    const top = below ? Math.min(local.y + 36, height - 88) : Math.min(Math.max(local.y, 128), height - 48)
    return { left, top, transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -120%)' }
  }
  async function commitPick(apple: Apple, color: SubjectKey, at: { x: number; y: number }) {
    if (picking.current.has(apple.id)) return
    if (apple.kind === 'rainbow' && !isCoreSubject(color)) return
    picking.current.add(apple.id)
    setRainbowAt(null)
    setHidden((prev) => {
      const next = new Set(prev)
      next.add(apple.id)
      return next
    })
    const meta = SUBJECTS[color]
    const gem = piles.current[color]
    const pile = gem?.getClientRects().length ? gem : chestRef.current
    const box = pile?.getBoundingClientRect()
    const to = box
      ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      : { x: at.x, y: Math.min(window.innerHeight - 72, at.y + 200) }
    const rainbow = apple.kind === 'rainbow'
    const landed = () => {
      bump(pile)
    }
    const effects = fx.current
    if (effects && !effects.prefersReducedMotion()) {
      effects.pluck(at.x, at.y, to.x, to.y, meta.color, meta.deep, rainbow, landed)
    } else landed()
    try {
      const next = await run(
        rainbow && isCoreSubject(color) ? { kind: 'pick', id: apple.id, color } : { kind: 'pick', id: apple.id },
      )
      if (!next || next.apples.some((item) => item.id === apple.id)) {
        releaseItem(apple.id)
        notify('这颗苹果未保存成功，请再摘一次。')
        return
      }
      addFloat(at.x, at.y, `${rainbow ? '🌈 ' : ''}+1 ${meta.stone}`, meta.color)
      if (rainbow && next.boxReady) {
        const wait = effects?.prefersReducedMotion() ? 0 : 980
        if (boxTimer.current !== null) window.clearTimeout(boxTimer.current)
        boxTimer.current = window.setTimeout(() => {
          boxTimer.current = null
          show('box')
        }, wait)
      }
    } catch {
      releaseItem(apple.id)
      notify('这颗苹果未保存成功，请再摘一次。')
    } finally {
      picking.current.delete(apple.id)
    }
  }
  function beginPick(id: string, at: { x: number; y: number }) {
    if (!tree || picking.current.has(id)) return
    const apple = tree.apples.find((item) => item.id === id)
    if (!apple) return
    if (apple.kind === 'rainbow') {
      setRainbowAt({ id, x: at.x, y: at.y })
      return
    }
    void commitPick(apple, apple.kind, at)
  }
  function openItem(kind: ItemKind, id: string, rect?: DOMRect) {
    if (kind === 'bud') {
      if (states[id] === 'done') void clickBubble(id)
      else setStep(id)
      return
    }
    if (kind === 'apple') {
      beginPick(id, applePoint(id, rect))
      return
    }
    setRainbowAt(null)
    setItem(id)
    show(kind)
  }
  const hasFlowers = tree.steps.some(canGrowWithSun)
  const dailyRainbowStep = tree.steps.find(item => item.dailyRainbow && item.end && dayOf(item.end) === skyDay)
  let magicLabel = '让花长大'
  if (casting) magicLabel = '施法中…'
  else if (busy) magicLabel = '正在保存…'
  else if (!hasFlowers) magicLabel = '没花了'
  else if (tree.sun < SUN_MAGIC_COST) magicLabel = `还差 ${SUN_MAGIC_COST - tree.sun} 个阳光`

  return (
    <div
      ref={scene}
      className="tg-scene tg-scene--responsive-rail z-40"
      data-daypart={daypartOf(hour)}
      data-panels-packed={panelsPacked}
      onPointerDownCapture={(event) => {
        if (!rainbowAt) return
        const node = event.target
        const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null
        if (element?.closest('[data-rainbow-pick]')) return
        setRainbowAt(null)
      }}
    >
      <Sky daypart={daypartOf(hour)} />
      <div className="tg-tree-wrap">
        <TreeScene
          ref={treeRef}
          state={state}
          regions={regions}
          fresh={fresh}
          hidden={hiddenTreeItems}
          onItem={openItem}
          onRegion={(region) => setTaskDays(region.dateKey ? [region.dateKey] : region.mergedKeys)}
        />
      </div>
        <ScatteredBubbles
          bubbles={bubbles}
          slots={state.bubbleSlots}
          states={states}
          clockOffsetMs={api.clockOffsetMs}
          startedAt={Object.fromEntries(
            air.filter((s) => s.start && !s.end).map((s) => [s.id, s.start!]),
          )}
          onOpen={(id) => void clickBubble(id)}
          onHoldFinish={(busy && !api.startingStepId) || savingBubble ? undefined : (id) => void completeRunning(id)}
          savingIds={savingIds}
          hiddenIds={hiddenTreeItems}
        />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 whitespace-nowrap p-3">
        <Flex data-tree-obstacle className="pointer-events-auto" gap="2" align="center">
          <StickerCard asChild interactive size="sm" tone="paper" elevation="sm">
            <Link href="/">← 首页</Link>
          </StickerCard>
        </Flex>
        <Flex data-tree-obstacle className="pointer-events-auto min-w-0" gap="2" align="center">
          {desktop && status}
          <MinimizeTimeTreeButton disabled={busy} />
        </Flex>
      </header>
      <aside id="tree-side-panels" ref={rail} hidden={panelsPacked} data-tree-obstacle className="tg-stone-rail" aria-label="生命树面板">
        {!desktop && status}
        <StonePanel
          state={state}
          thresholds={tree.rules}
          lifeThreshold={lifeThreshold}
          canExchange={canExchange}
          busy={busy}
          onExchange={() => show('wish')}
          onWishHint={message => notify(message ?? (nextWish ? `下次可在 ${nextWish} 兑换心愿。` : '稍后可兑换心愿。'))}
          mobileActions={
            tree.apples.length > 0 && (
              <Button variant="soft" onClick={() => show('fruitList')}>
                🍎 摘果子 {tree.apples.length}
              </Button>
            )
          }
          registerPile={(key, el) => {
            piles.current[key] = el
          }}
        />
        <StickerCard size="sm" tone="paper" className="tg-rail-tools md:mt-2">
          <Flex direction="column" gap="2">
            {nextWish && nextWish > tree.today && (
              <Text size="1" className="max-md:hidden">
                下次心愿 {nextWish}
              </Text>
            )}
            <Button color="violet" variant="soft" className="whitespace-nowrap" aria-label={`盲盒${boxChances ? `，还能抽 ${boxChances} 次` : ''}`}
              onClick={() => show('box')}>
              <Gift aria-hidden="true" size={18} className="shrink-0" /> 盲盒
              {boxChances > 0 && <Badge color="violet" radius="full" aria-hidden="true">+{boxChances}</Badge>}
            </Button>
            {dailyRainbowStep && (
              <Button color="violet" variant="soft" onClick={() => {
                setRewardStep(dailyRainbowStep)
              }}>🌈 查看彩虹果奖励</Button>
            )}
            <Text size="1" className="max-md:hidden">
              {tree.dailyRainbowDay === tree.today ? '🌈 今日全完成彩虹果已获得！' : '今天学习任务全部完成，最后一颗苹果变彩虹果！'}
            </Text>
            <Text size="1" color="gray" className="max-md:hidden">
              累计奖励：再结 {12 - (tree.appleCount % 12)} 个学科苹果长出彩虹果
            </Text>
            {tree.apples.length > 0 && (
              <Button size="1" variant="soft" onClick={() => show('fruitList')}>
                摘果子（{tree.apples.length}）
              </Button>
            )}
            <Button
              color="amber"
              style={{ height: 'auto', paddingBlock: 8 }}
              disabled={busy || casting || !hasFlowers || tree.sun < SUN_MAGIC_COST}
              onClick={async () => {
                setCasting(true)
                try {
                  await run({ kind: 'magic' })
                } finally {
                  setCasting(false)
                }
              }}
            >
              <span className="flex min-w-0 flex-col items-center gap-1">
                <span className="whitespace-nowrap text-xs">{magicLabel}</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
                  <Sun aria-hidden="true" size={16} /> {SUN_MAGIC_COST} 阳光
                </span>
              </span>
            </Button>
            <Button asChild variant="soft">
              <Link href="/tasks/homework">作业</Link>
            </Button>
          </Flex>
        </StickerCard>
      </aside>
      <div
        className="pointer-events-none flex items-end justify-between"
        style={{
          position: 'fixed',
          left: 'calc(0.5rem + env(safe-area-inset-left, 0px))',
          right: 'var(--tg-panel-right, calc(0.5rem + env(safe-area-inset-right, 0px)))',
          bottom: 'var(--tg-panel-bottom, calc(0.5rem + env(safe-area-inset-bottom, 0px)))',
          zIndex: 35,
        }}
      >
        <IconButton
          data-tree-obstacle
          type="button"
          variant="ghost"
          color="green"
          className="tg-box-button pointer-events-auto"
          aria-label={`枯萎箱，${wilted.length} 件`}
          title="枯萎箱"
          onClick={() => show('wilt')}
        >
          <WiltBin count={wilted.length} />
        </IconButton>
        <IconButton
          data-tree-obstacle
          ref={chestRef}
          type="button"
          variant="ghost"
          color="amber"
          className="tg-box-button tg-chest-button pointer-events-auto"
          aria-controls="tree-status-panel tree-side-panels"
          aria-expanded={!panelsPacked}
          aria-label={panelsPacked ? '打开宝箱，展开所有面板' : '收起所有面板到宝箱'}
          title={panelsPacked ? '展开所有面板' : '收起所有面板'}
          onClick={togglePanels}
        >
          <Image src="/icons/time-tree-chest.webp" alt="" width={288} height={180}
            hidden={!panelsPacked} loading="eager" draggable={false} unoptimized className="h-auto w-full" />
          <Image src="/icons/time-tree-chest-open.webp" alt="" width={288} height={251}
            hidden={panelsPacked} loading="eager" draggable={false} unoptimized className="h-auto w-full" />
        </IconButton>
      </div>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 size-full"
      />
      <div className="pointer-events-none absolute inset-0 z-30">
        {floats.map((item) => (
          <span key={item.id} className="tg-float-text" style={{ left: item.x, top: item.y, color: item.color }}>
            {item.text}
          </span>
        ))}
      </div>
      {rainbowAt && (
        <div
          role="group"
          aria-label="彩虹果放进哪一堆"
          data-rainbow-pick
          className="absolute z-30"
          style={rainbowChooserStyle(rainbowAt)}
        >
          <div className="tg-rainbow-pick flex max-w-[19rem] flex-wrap justify-center gap-2">
            {CORE_SUBJECTS.map((color) => (
              <Button
                key={color}
                size="2"
                color={PILE_COLOR[color]}
                aria-label={`放进${SUBJECTS[color].stone}`}
                onClick={() => {
                  const apple = tree.apples.find((item) => item.id === rainbowAt.id)
                  if (apple) void commitPick(apple, color, { x: rainbowAt.x, y: rainbowAt.y })
                }}
              >
                {SUBJECTS[color].emoji} {SUBJECTS[color].stone}
              </Button>
            ))}
          </div>
        </div>
      )}
      {flowerReward.toast}
      {sceneNotice && (notice || !flowerReward.toast) && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center"
        >
          <StickerCard size="sm">{sceneNotice}</StickerCard>
        </div>
      )}
      {(taskDays || dialog === 'diary') && !history.tree && (
        <AppDialog open title={taskDays ? '日期作业' : '成长日记'} onOpenChange={open => {
          if (!open) { setTaskDays(null); show('') }
        }}><TreeWait api={history} /></AppDialog>
      )}
      {taskDays && history.tree && !step && !rewardStep && (
        <DayTasksDialog
          tree={history.tree}
          days={taskDays}
          busy={busy}
          message={api.message}
          onAdd={async (day, name, id) => Boolean(await run({ kind: 'addCrown', day, name, id }))}
          onPop={id => void clickBubble(id)}
          onClose={() => setTaskDays(null)}
          onSelect={setStep}
        />
      )}
      {step && (
        <StepPanel
          key={step.id}
          api={history}
          step={step}
          select={setStep}
          close={() => setStep(null)}
          onFinished={(finished, snapshot, bloom) => {
            if (bloom) sow(finished, snapshot, true)
            flowerReward.showReward(finished)
          }}
          onFinishBubble={(current) => {
            if ((busy && api.startingStepId !== current.id) || completingBubble.current) return
            setStep(null)
            void completeRunning(current.id)
          }}
        />
      )}
      <AppDialog open={!!rewardStep} title="全部完成，收获彩虹果！" onOpenChange={open => { if (!open) setRewardStep(null) }}>
        {rewardStep && (
          <Flex direction="column" gap="4" align="center" p="4">
            {rewardStep.dailyRainbow && <DailyRainbowReward />}
            <Text size="4" weight="bold">{rewardStep.name}</Text>
            <Text size="6" weight="bold">🌸 +{rewardStep.stages.length}　☀️ +{rewardStep.sun}　💧 +{rewardStep.water}</Text>
            {rewardStep.tomatoes && <Text size="5" weight="bold" color="tomato">🍅 收获 {rewardStep.tomatoes} 颗番茄</Text>}
            {isEarly(rewardStep) && (
              <Flex direction="column" gap="2" align="center">
                <Badge color="amber" size="3">提前完成额外奖励</Badge>
                <Text size="5" weight="bold" color="amber">☀️ +{rewardStep.sun / 2}　💧 +{rewardStep.water / 2}</Text>
                <Text size="2" color="gray">额外奖励已包含在上方总奖励中</Text>
              </Flex>
            )}
            <Button onClick={() => setRewardStep(null)}>太棒了！</Button>
          </Flex>
        )}
      </AppDialog>
      {dialog === 'diary' && history.tree && diaryFrom && diaryThrough && (
        <DiaryDialog tree={history.tree} rings={state.rings} onClose={() => { setDiaryPage(0); close() }}
          period={{ from: diaryFrom, through: diaryThrough,
            older: diaryFrom > tree.firstDay ? () => setDiaryPage(diaryPage + 1) : undefined,
            newer: diaryPage ? () => setDiaryPage(diaryPage - 1) : undefined }} />
      )}
      {dialog === 'box' && <BlindBoxDrawer api={api} close={close} />}
      <AppDialog
        open={!!dialog && dialog !== 'diary' && dialog !== 'box'}
        closeDisabled={busy && dialog !== 'wilt' && dialog !== 'later' && dialog !== 'diary'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          {
            '': '生命树',
            wilt: '枯萎箱',
            later: '更后面的作业',
            diary: '成长日记',
            box: '盲盒',
            tomato: '🍅 番茄兑换',
            wish: '兑换心愿',
            flower: flower?.name,
            fruitList: '待摘的苹果',
          }[dialog] || '生命树'
        }
      >
        <Flex direction="column" gap="3">
          {dialog === 'wilt' && (
            <>
              <Text size="2" color="gray">这些日子过去了还没做完。点进去就能补做。</Text>
              <GroupedSteps
                steps={wilted}
                descending
                empty="现在没有枯萎的作业。"
                onSelect={(id) => {
                  close()
                  setStep(id)
                }}
              />
            </>
          )}
          {dialog === 'later' && (
            <GroupedSteps
              steps={laterSteps}
              empty="七天里都排得下。"
              onSelect={(id) => {
                close()
                setStep(id)
              }}
            />
          )}
          {dialog === 'wish' && (
            <>
              <Text>红、黄、蓝宝石各用 {tree.rules.wish} 颗，再用 {lifeThreshold} 颗绿松石，换一份约好的心愿。</Text>
              <TextField.Root
                type="password"
                aria-label="家长密码"
                placeholder="六位家长密码"
                value={pin}
                maxLength={6}
                onChange={(e) => setPin(e.target.value)}
              />
              <Button
                loading={busy}
                disabled={pin.length !== 6 || !canExchange}
                onClick={async () => {
                  if (await run({ kind: 'exchange', pin })) {
                    close()
                    notify('🎁 心愿兑换成功')
                  }
                }}
              >
                确认兑换
              </Button>
            </>
          )}
          {dialog === 'flower' && flower && (
            <>
              <Text>
                {timing(flower)} · ☀️ +{flower.sun} · 💧 +{flower.water}
              </Text>
              <Button
                loading={busy}
                onClick={async () => {
                  if (await run({ kind: 'water', id: itemId })) close()
                }}
              >
                浇一滴水
              </Button>
              <Button
                variant="soft"
                onClick={() => {
                  close()
                  setStep(flower.id)
                }}
              >
                查看完成记录
              </Button>
            </>
          )}
          {dialog === 'fruitList' &&
            tree.apples.map((a) => (
              <Button
                key={a.id}
                variant="soft"
                disabled={hidden.has(a.id)}
                onClick={() => {
                  const at = applePoint(a.id)
                  close()
                  if (a.kind === 'rainbow') setRainbowAt({ id: a.id, x: at.x, y: at.y })
                  else void commitPick(a, a.kind, at)
                }}
              >
                {a.dateKey} · {a.kind === 'rainbow' ? '🌈 彩虹果' : SUBJECTS[a.kind].label + '苹果'}
              </Button>
            ))}
          {dialog === 'tomato' && (
            <>
              <Flex align="center" gap="2" wrap="wrap">
                <Badge color="tomato" size="3">可用 {tomatoBalance} 颗</Badge>
                <Text size="2" color="gray">累计获得 {wallet.earned} 颗</Text>
              </Flex>
              <Theme accentColor="tomato" hasBackground={false}>
                <ul className="flex flex-col gap-3">
                  {CORE_SUBJECTS.map(color => {
                    const price = prices.gems[color]
                    return (
                      <TomatoExchangeRow key={color} title={SUBJECTS[color].stone} cost={price}
                        icon={<Gem color={SUBJECTS[color].color} deep={SUBJECTS[color].deep} />}>
                        <Button type="button" color="amber" variant="solid" size="3" className="min-h-11 min-w-18 shrink-0"
                          aria-label={`用 ${price} 颗番茄兑换 ${SUBJECTS[color].stone}`}
                          disabled={busy || tomatoBalance < price}
                          onClick={async () => {
                            notify('')
                            if (await run({ kind: 'exchangeTomatoes', color, tomatoPrice: price })) {
                              notify(`兑换成功，获得 1 颗${SUBJECTS[color].stone}`)
                            }
                          }}>
                          兑换
                        </Button>
                      </TomatoExchangeRow>
                    )
                  })}
                  <TomatoExchangeRow icon={<Gift aria-hidden="true" size={24} />} title="番茄盲盒" cost={prices.box}>
                    <Button type="button" color="amber" size="3" className="min-h-11 min-w-18 shrink-0"
                      disabled={busy || (!tree.prize && boxChances === 0)} onClick={() => show('box')}>
                      {tree.prize ? '领奖' : '盲盒'}
                    </Button>
                  </TomatoExchangeRow>
                </ul>
              </Theme>
              {notice && <Text size="2" role="status">{notice}</Text>}
            </>
          )}
          {api.message && (
            <Text role="alert" color="red">
              {api.message}
            </Text>
          )}
        </Flex>
      </AppDialog>
    </div>
  )
}
