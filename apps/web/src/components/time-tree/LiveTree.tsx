'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { AppDialog, LearningIcon, PocketMenuButton, StickerCard, Sun } from '@rosie/ui'
import { Badge, Button, Flex, Popover, Text, TextField } from '@rosie/ui/themes'
import TreeScene, { type ItemKind, type TreeSceneHandle } from '@/components/tree-demo/garden/TreeScene'
import Sky, { daypartOf } from '@/components/tree-demo/garden/Sky'
import type { BubbleState } from '@/components/tree-demo/garden/Bubbles'
import ScatteredBubbles from './ScatteredBubbles'
import StonePanel from '@/components/tree-demo/garden/StonePanel'
import { buildRegions, todayCenter, type Region } from '@/components/tree-demo/garden/layout'
import { bubbleSubject, CORE_SUBJECTS, SUBJECTS, type Apple, type CoreSubject, type SubjectKey } from '@/components/tree-demo/garden/model'
import { GardenFx } from '@/components/tree-demo/garden/fx'
import { SUN_MAGIC_COST, canGrowWithSun, dayOf, isMustDo, shift, timing, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { DiaryDialog } from '@/components/tree-demo/garden/GardenDialogs'
import { isEarly } from '@/lib/time-tree/rewards'
import { sceneState } from './sceneState'
import { finishAndPop } from './finishStep'
import { StepPanel, TreeWait } from './StepPanel'
import DailyRainbowReward from './DailyRainbowReward'
import DayTasksDialog from './DayTasksDialog'
import { useTimeTree } from './useTimeTree'
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

function doneNotice(step: Pick<WorkStep, 'name' | 'sun' | 'water'>): string {
  const reward = step.sun || step.water ? ` · ☀️ +${step.sun} · 💧 +${step.water}` : ''
  return `🌸 ${step.name}完成啦！${reward}`
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
  vertical: boolean
  sunRef: RefObject<HTMLSpanElement | null>
  waterRef: RefObject<HTMLSpanElement | null>
  onDiary: () => void
  onLater: () => void
}

/** 顶部进度与入口区。桌面内联展示，移动端收进「菜单」浮层，两处共用同一份结构。 */
function TreeStatusContent({
  mustCount,
  mustDone,
  streak,
  sun,
  water,
  laterCount,
  vertical,
  sunRef,
  waterRef,
  onDiary,
  onLater,
}: StatusContentProps) {
  return (
    <Flex gap="2" direction={vertical ? 'column' : 'row'} align={vertical ? 'stretch' : 'center'} wrap={vertical ? 'nowrap' : 'wrap'}>
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
                return (
                  <StickerCard key={step.id} asChild interactive tone="paper" size="sm" elevation="sm" radius="md">
                    {/* native-ok: 多行作业卡通过 StickerCard 提供外观，按钮提供整卡键盘操作。 */}
                    <button type="button" onClick={() => onSelect(step.id)} aria-label={`${label}，${step.name}，${subject.label}，预计 ${step.minutes} 分钟`}>
                      <span className="flex items-center gap-3 text-left">
                        <span aria-hidden="true" className="text-2xl">{step.crown ? <LearningIcon name="crown" size={24} /> : subject.emoji}</span>
                        <span className="min-w-0">
                          <Text as="span" size="3" weight="bold" className="block break-words">{step.name}</Text>
                          <Text as="span" size="2" color="gray">{subject.label} · 预计 {step.minutes} 分钟</Text>
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
  const [casting, setCasting] = useState(false)
  const { tree, busy, run } = api
  const [stepId, setStep] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const desktop = useSyncExternalStore(subscribeStatusLayout, inlineStatus, serverStatus)
  const [taskDays, setTaskDays] = useState<string[] | null>(null)
  const [dialog, show] = useState<'' | 'wilt' | 'later' | 'diary' | 'box' | 'wish' | 'flower' | 'fruitList'>('')
  const [rainbowAt, setRainbowAt] = useState<{ id: string; x: number; y: number } | null>(null)
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([])
  const [itemId, setItem] = useState('')
  const [pin, setPin] = useState('')
  const [notice, notify] = useState('')
  const [rewardStep, setRewardStep] = useState<WorkStep | null>(null)
  const [showRainbowDetails, setShowRainbowDetails] = useState(false)
  const [savingBubble, setSavingBubble] = useState<string | null>(null)
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
  const menuRef = useRef<HTMLButtonElement>(null)
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
      minutes.total += step.minutes
      if (step.end) minutes.completed += step.minutes
      byDay.set(step.planned, minutes)
    }
    return buildRegions(state, true, previousRegions.current).map((region) => {
      if (region.dateKey) {
        return { ...region, plannedMinutes: byDay.get(region.dateKey) ?? { completed: 0, total: 0 } }
      }
      const total = region.mergedKeys.reduce((sum, day) => sum + (byDay.get(day)?.total ?? 0), 0)
      return { ...region, plannedMinutes: { completed: 0, total } }
    })
  }, [state, tree])
  useEffect(() => { previousRegions.current = regions }, [regions])
  const ready = !!tree
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
  const air = tree.steps.filter((s) => s.slot !== null)
  const must = tree.steps.filter((s) => s.planned === tree.today && !s.skipped && isMustDo(s.priority))
  const mustDone = must.filter((s) => s.end).length
  const wilted = tree.steps.filter((s) => s.subject !== 'life' && !s.skipped && !s.end && !!s.planned && s.planned < tree.today)
  const horizon = shift(tree.today, 6)
  const laterSteps = tree.steps.filter((s) => !s.skipped && !s.end && !!s.planned && s.planned > horizon)
  const states: Record<string, BubbleState> = Object.fromEntries(
    air.map((s): [string, BubbleState] => [
      s.id,
      s.end
        ? 'done'
        : s.start
          ? 'running'
          : s.planned && s.planned < tree.today
            ? 'overdue'
            : 'ready',
    ]),
  )
  const step = tree.steps.find((s) => s.id === stepId)
  const flower = tree.steps.find((s) => s.id === itemId.split('#')[0])
  const lastWish = tree.exchanges.at(-1)
  const nextWish = lastWish && shift(lastWish, 7)
  const canExchange =
    (!nextWish || tree.today >= nextWish) &&
    CORE_SUBJECTS.every((k) => tree.stones[k] >= tree.rules.wish)
  const close = () => {
    show('')
    setPin('')
  }
  const closeMenu = () => setMobileMenuOpen(false)
  const status = (
    <TreeStatusContent
      mustCount={must.length}
      mustDone={mustDone}
      streak={tree.streak ?? 0}
      sun={tree.sun}
      water={tree.water}
      laterCount={laterSteps.length}
      vertical={!desktop}
      sunRef={sunRef}
      waterRef={waterRef}
      onDiary={() => {
        closeMenu()
        show('diary')
      }}
      onLater={() => {
        closeMenu()
        show('later')
      }}
    />
  )

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
    // 移动端菜单收起时 ☀️/💧 徽章未挂载，改用「菜单」按钮作为落点，保持奖励动效。
    const target = el ?? menuRef.current
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
  function sow(
    step: WorkStep,
    treeData: TreeData,
    rewards: boolean,
    origin: { x: number; y: number } | null = null,
    onBloomed?: () => void,
    burst = true,
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
      if (burst) effects.burst(from.x, from.y, bubbleSubject(step).color)
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
    if (s.subject !== 'life' && !s.end) {
      setStep(id)
      return
    }
    if (s.subject !== 'life' && (busy || completingBubble.current)) return
    if (s?.subject !== 'life' && s?.end) {
      await completeRunning(id)
      return
    }
    if (s?.subject === 'life' && !s.end) {
      if (popping.current.has(id)) return
      popping.current.add(id)
      const origin = bubbleCenter(id)
      setHidden(previous => new Set(previous).add(id))
      if (origin && fx.current && !fx.current.prefersReducedMotion()) {
        fx.current.burst(origin.x, origin.y, bubbleSubject(s).color)
      }
      try {
        const result = await run({ kind: 'pop', id })
        const done = result?.steps.find(item => item.id === id)
        if (!result || !done?.end) {
          releaseItem(id)
          notify('这颗泡泡未保存成功，请再点一次。')
          return
        }
        sow(done, result, false, origin, undefined, false)
        notify(doneNotice(done))
      } catch {
        releaseItem(id)
        notify('这颗泡泡未保存成功，请再点一次。')
      } finally {
        popping.current.delete(id)
      }
      return
    }
    const origin = bubbleCenter(id)
    const result = await run({ kind: 'pop', id })
    if (!result) return
    sow(result.steps.find((item) => item.id === id) ?? s, result, false, origin)
    notify('🌸 ' + s.name + '完成啦！')
  }
  async function completeRunning(id: string) {
    if (busy || completingBubble.current) return
    const step = air.find((item) => item.id === id)
    if (!step || (!step.start && !step.end)) return
    if (step.flowers && !step.end) { setStep(id); return }
    completingBubble.current = true
    setSavingBubble(id)
    const origin = bubbleCenter(id)
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
      const showReward = () => {
        release()
        notify(doneNotice(outcome.step))
        setShowRainbowDetails(false)
        setRewardStep(outcome.step)
      }
      if (outcome.bloom) sow(outcome.step, outcome.tree, true, origin, showReward)
      else showReward()
    } catch {
      release()
      notify('操作未完成，请查看泡泡状态后重试。')
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
    const pile = piles.current[color] ?? null
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
  else if (!hasFlowers) magicLabel = '暂无可催开的花'
  else if (tree.sun < SUN_MAGIC_COST) magicLabel = `还差 ${SUN_MAGIC_COST - tree.sun} 个阳光`

  return (
    <div
      ref={scene}
      className="tg-scene tg-scene--responsive-rail z-40"
      data-daypart={daypartOf(hour)}
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
          hidden={hidden}
          onItem={openItem}
          onParked={() => show('wilt')}
          bin={{ title: '枯萎箱', count: wilted.length }}
          onRegion={(region) => setTaskDays(region.dateKey ? [region.dateKey] : region.mergedKeys)}
        />
      </div>
        <ScatteredBubbles
          bubbles={state.buds.filter((b) => states[b.id])}
          slots={state.bubbleSlots}
          states={states}
          clockOffsetMs={api.clockOffsetMs}
          startedAt={Object.fromEntries(
            air.filter((s) => s.start && !s.end).map((s) => [s.id, s.start!]),
          )}
          onOpen={(id) => void clickBubble(id)}
          onHoldFinish={busy || savingBubble ? undefined : (id) => void completeRunning(id)}
          savingId={savingBubble}
          hiddenIds={hidden}
        />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3">
        <Flex data-tree-obstacle className="pointer-events-auto" gap="2" align="center">
          <StickerCard asChild interactive size="sm" tone="paper" elevation="sm">
            <Link href="/">← 首页</Link>
          </StickerCard>
          <span className="tg-logo">🌳 生命树</span>
        </Flex>
        <Flex data-tree-obstacle className="pointer-events-auto" gap="2" align="center">
        {desktop ? (
          <StickerCard data-tree-obstacle className="pointer-events-auto" size="sm" tone="paper">
            {status}
          </StickerCard>
        ) : (
          <Popover.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <Popover.Trigger>
              <PocketMenuButton ref={menuRef} data-tree-obstacle className="pointer-events-auto" aria-label="小口袋菜单" />
            </Popover.Trigger>
            <Popover.Content side="bottom" align="end" sideOffset={8} size="2" className="tg-status-pop">
              {status}
            </Popover.Content>
          </Popover.Root>
        )}
          <MinimizeTimeTreeButton disabled={busy} />
        </Flex>
      </header>
      <aside ref={rail} data-tree-obstacle className="tg-stone-rail" aria-label="宝石与工具">
        <StonePanel
          bottomOnMobile
          state={state}
          thresholds={tree.rules}
          canExchange={canExchange && !busy}
          onExchange={() => show('wish')}
          mobileActions={
            <>
              <Button color="violet" variant="soft" onClick={() => show('box')}>
                🎁 {tree.boxReady ? '开盲盒' : '盲盒'}
              </Button>
              {tree.apples.length > 0 && (
                <Button variant="soft" onClick={() => show('fruitList')}>
                  🍎 摘果子 {tree.apples.length}
                </Button>
              )}
            </>
          }
          registerPile={(key, el) => {
            piles.current[key] = el
          }}
        />
        <StickerCard size="sm" tone="paper" className="tg-rail-tools mt-2">
          <Flex direction="column" gap="2">
            {nextWish && nextWish > tree.today && (
              <Text size="1" className="max-md:hidden">
                下次心愿 {nextWish}
              </Text>
            )}
            <Button color="violet" variant="soft" onClick={() => show('box')}>
              🎁 {tree.boxReady ? '打开盲盒' : '我的盲盒'}
            </Button>
            {dailyRainbowStep && (
              <Button color="violet" variant="soft" onClick={() => {
                setRewardStep(dailyRainbowStep)
                setShowRainbowDetails(true)
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
              <Link href="/tasks/homework">作业管理</Link>
            </Button>
          </Flex>
        </StickerCard>
      </aside>
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
      {(api.message || notice) && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center"
        >
          <StickerCard size="sm">{api.message || notice}</StickerCard>
        </div>
      )}
      {taskDays && !step && !rewardStep && (
        <DayTasksDialog
          tree={tree}
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
          api={api}
          step={step}
          select={setStep}
          close={() => setStep(null)}
          onFinishBubble={(current) => {
            if (busy || completingBubble.current) return
            setStep(null)
            void completeRunning(current.id)
          }}
          onFinished={(finished, snapshot, bloom) => {
            if (finished.dailyRainbow) {
              if (bloom) sow(finished, snapshot, true)
              setStep(null)
              setTaskDays(null)
              setShowRainbowDetails(false)
              setRewardStep(finished)
              notify('🌈 今天的学习任务全部完成，彩虹果已经长在树上啦！')
              return
            }
            if (finished.flowers) {
              if (bloom) sow(finished, snapshot, true)
              return
            }
            notify(doneNotice(finished))
            setRewardStep(finished)
          }}
        />
      )}
      <AppDialog open={!!rewardStep && (!rewardStep.dailyRainbow || showRainbowDetails)} title={rewardStep?.dailyRainbow ? '全部完成，收获彩虹果！' : rewardStep && isEarly(rewardStep) ? '提前完成，奖励翻倍！' : '完成啦，坚持就有收获！'} onOpenChange={(open) => { if (!open) { setRewardStep(null); setShowRainbowDetails(false) } }}>
        {rewardStep && (
          <Flex direction="column" gap="4" align="center" p="4">
            {rewardStep.dailyRainbow && <DailyRainbowReward />}
            <Text size="4" weight="bold">{rewardStep.name}</Text>
            <Text size="6" weight="bold">🌸 +{rewardStep.stages.length}　☀️ +{rewardStep.sun}　💧 +{rewardStep.water}</Text>
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
      <DiaryDialog
        open={dialog === 'diary'}
        entries={(tree.diary ?? []).map((entry) => ({ ...entry, t: Date.parse(entry.t) }))}
        totalPops={(tree.diary ?? []).filter((entry) => entry.icon === '🌸' || entry.icon === '🍂').length}
        rings={state.rings}
        exchanges={tree.exchanges.length}
        onClose={close}
      />
      <AppDialog
        open={!!dialog && dialog !== 'diary'}
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
            box: '🎁 我的盲盒',
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
              <Text>红、黄、蓝各用 {tree.rules.wish} 颗，换一份约好的心愿。</Text>
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
                disabled={pin.length !== 6}
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
          {dialog === 'box' &&
            (tree.prize ? (
              <>
                <Text weight="bold">🎁 {tree.prize.name}</Text>
                <Button
                  loading={busy}
                  onClick={async () => {
                    if (await run({ kind: 'acceptBox', id: tree.prize!.ticket })) {
                      close()
                      notify('已收下奖励')
                    }
                  }}
                >
                  接受奖励
                </Button>
              </>
            ) : tree.boxReady ? (
              <>
                <Button
                  loading={busy}
                  onClick={async () => {
                    const t = await run({ kind: 'openBox' })
                    if (t && !t.prize) notify('盲盒待补充，可到奖惩管理勾选小奖励。')
                  }}
                >
                  打开我的盲盒
                </Button>
                <Button asChild variant="soft">
                  <Link href="/setting/draw-pools">去奖惩管理补充</Link>
                </Button>
                {notice && <Text>{notice}</Text>}
              </>
            ) : (
              <Text>
                摘下彩虹果可获得盲盒机会。{tree.lastBox && '下次最早 ' + shift(tree.lastBox, 7)}
              </Text>
            ))}
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
