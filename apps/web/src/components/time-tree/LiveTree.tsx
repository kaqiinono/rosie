'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppDialog, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextField } from '@rosie/ui/themes'
import TreeScene, { type ItemKind, type TreeSceneHandle } from '@/components/tree-demo/garden/TreeScene'
import Sky, { daypartOf } from '@/components/tree-demo/garden/Sky'
import Bubbles, { type BubbleState } from '@/components/tree-demo/garden/Bubbles'
import StonePanel from '@/components/tree-demo/garden/StonePanel'
import { buildRegions, todayCenter } from '@/components/tree-demo/garden/layout'
import { CORE_SUBJECTS, SUBJECTS } from '@/components/tree-demo/garden/model'
import { gardenAudio } from '@/components/tree-demo/garden/audio'
import { GardenFx } from '@/components/tree-demo/garden/fx'
import { shift, timing, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { sceneState } from './sceneState'
import { finishAndPop } from './finishStep'
import { StepPanel, TreeWait } from './StepPanel'
import { useTimeTree } from './useTimeTree'
import '@/components/tree-demo/garden/garden.css'

function bump(el: HTMLElement | null): void {
  if (!el) return
  el.classList.remove('tg-bump')
  void el.offsetWidth
  el.classList.add('tg-bump')
}

function doneNotice(step: Pick<WorkStep, 'name' | 'sun' | 'water'>): string {
  const reward = step.sun || step.water ? ` · ☀️ +${step.sun} · 💧 +${step.water}` : ''
  return `🌸 ${step.name}完成啦！${reward}`
}

function ParkedTasks({ steps, onSelect }: { steps: WorkStep[]; onSelect: (id: string) => void }) {
  const groups = new Map<string, WorkStep[]>()
  for (const step of steps) {
    if (step.skipped || step.planned || step.end) continue
    const group = groups.get(step.scheduled)
    if (group) group.push(step)
    else groups.set(step.scheduled, [step])
  }
  if (!groups.size) return <Text>这里暂时没有作业。</Text>

  return (
    <Flex direction="column" gap="4">
      {Array.from(groups.keys()).sort().map((day) => {
        const date = new Date(day + 'T00:00:00Z')
        const label = `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 · 周${'日一二三四五六'[date.getUTCDay()]}`
        return (
          <section key={day}>
            <h3 className="mb-2 font-bold">
              <time dateTime={day}>{label}</time>
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.get(day)?.map((step) => {
                const subject = SUBJECTS[step.subject]
                return (
                  <StickerCard key={step.id} asChild interactive tone="paper" size="sm" elevation="sm" radius="md">
                    {/* native-ok: 多行作业卡通过 StickerCard 提供外观，按钮提供整卡键盘操作。 */}
                    <button type="button" onClick={() => onSelect(step.id)} aria-label={`${label}，${step.name}，${subject.label}，预计 ${step.minutes} 分钟`}>
                      <span className="flex items-center gap-3 text-left">
                        <span aria-hidden="true" className="text-2xl">{subject.emoji}</span>
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
  useEffect(() => {
    if (!navigator.wakeLock) return
    let lock: WakeLockSentinel | undefined
    let generation = 0

    function release() {
      generation++
      if (lock && !lock.released) void lock.release().catch(() => {})
      lock = undefined
    }

    async function syncVisibility() {
      if (document.visibilityState !== 'visible') {
        release()
        return
      }
      if (lock && !lock.released) return
      const request = ++generation
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (request === generation) lock = acquired
        else await acquired.release()
      } catch {
        // 设备省电策略可能拒绝常亮，回到前台时再申请。
      }
    }

    void syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      release()
    }
  }, [])

  const api = useTimeTree()
  const { tree, busy, run } = api
  const [stepId, setStep] = useState<string | null>(null)
  const [dialog, show] = useState<'' | 'park' | 'box' | 'wish' | 'apple' | 'flower' | 'fruitList'>(
    '',
  )
  const [itemId, setItem] = useState('')
  const [pin, setPin] = useState('')
  const [notice, notify] = useState('')
  const [sound, setSound] = useState(true)
  const [hour, setHour] = useState(() => new Date().getHours())
  const [fresh, setFresh] = useState<Record<string, 'born'>>({})
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const fx = useRef<GardenFx | null>(null)
  const treeRef = useRef<TreeSceneHandle>(null)
  const sunRef = useRef<HTMLSpanElement>(null)
  const waterRef = useRef<HTMLSpanElement>(null)
  const bloomOrigin = useRef<{ id: string; at: { x: number; y: number } | null } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const state = useMemo(() => (tree ? sceneState(tree) : null), [tree])
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
    return buildRegions(state).map((region) => {
      if (region.dateKey) {
        return { ...region, plannedMinutes: byDay.get(region.dateKey) ?? { completed: 0, total: 0 } }
      }
      const total = region.mergedKeys.reduce((sum, day) => sum + (byDay.get(day)?.total ?? 0), 0)
      return { ...region, plannedMinutes: { completed: 0, total } }
    })
  }, [state, tree])
  useEffect(() => {
    gardenAudio.setSound(sound)
  }, [sound])
  const ready = !!tree
  useEffect(() => {
    if (!ready || !canvas.current || !dock.current) return
    const effects = new GardenFx()
    effects.attach(canvas.current, () => null)
    fx.current = effects
    const obs = new ResizeObserver(() => {
      // 树的底边 = 按钮坞高（桌面）；手机再加上底部宝石条高，见 garden.css
      scene.current?.style.setProperty('--tg-dock-h', (dock.current?.offsetHeight ?? 64) + 'px')
      scene.current?.style.setProperty('--tg-rail-h', (rail.current?.offsetHeight ?? 0) + 'px')
      effects.resize()
    })
    obs.observe(dock.current)
    if (rail.current) obs.observe(rail.current)
    if (scene.current) obs.observe(scene.current)
    const timer = setInterval(() => setHour(new Date().getHours()), 60000)
    return () => {
      clearInterval(timer)
      obs.disconnect()
      effects.detach()
      gardenAudio.dispose()
      fx.current = null
    }
  }, [ready])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => notify(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  if (!tree || !state)
    return (
      <main className="flex min-h-dvh flex-col">
        <TreeWait api={api} />
      </main>
    )
  const air = tree.steps.filter((s) => s.slot !== null)
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
  const fruit = tree.apples.find((a) => a.id === itemId)
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
  function flyCount(from: { x: number; y: number }, el: HTMLSpanElement | null, color: string, dy: number) {
    if (!el || !fx.current) return
    const box = el.getBoundingClientRect()
    fx.current.orb(
      from.x,
      from.y + dy,
      box.left + box.width / 2,
      box.top + box.height / 2,
      color,
      7,
      0.85,
      () => bump(el),
    )
  }
  function sow(
    step: WorkStep,
    treeData: TreeData,
    rewards: boolean,
    origin: { x: number; y: number } | null = null,
  ) {
    const from = bubbleCenter(step.id) ?? origin
    const ids = step.stages.map((_, index) => `${step.id}#${index}`)
    const effects = fx.current
    gardenAudio.ensure()
    gardenAudio.pop()
    if (!from || !effects) {
      if (ids.length) {
        gardenAudio.bloom()
        for (const id of ids) showFlower(id)
      }
      return
    }
    const reduced = effects.prefersReducedMotion()
    if (!reduced) {
      effects.burst(from.x, from.y, SUBJECTS[step.subject].color)
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
    const regions = buildRegions(sceneState(treeData))
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
    effects.flySeeds(from.x, from.y, seeds, (seed) => showFlower(seed.id))
  }
  async function clickBubble(id: string) {
    if (busy) return
    const s = air.find((x) => x.id === id)
    if (!s?.end) {
      setStep(id)
      return
    }
    const origin = bubbleCenter(id)
    const result = await run({ kind: 'pop', id })
    if (!result) return
    sow(result.steps.find((item) => item.id === id) ?? s, result, false, origin)
    notify('🌸 ' + s.name + '完成啦！')
  }
  async function completeRunning(id: string) {
    if (busy) return
    const step = air.find((item) => item.id === id)
    if (!step?.start || step.end) return
    const origin = bubbleCenter(id)
    const outcome = await finishAndPop(run, step)
    if (!outcome.ok) return
    if (outcome.bloom) sow(outcome.step, outcome.tree, true, origin)
    notify(doneNotice(outcome.step))
  }
  function openItem(kind: ItemKind, id: string) {
    if (kind === 'bud') {
      if (states[id] === 'done') void clickBubble(id)
      else setStep(id)
      return
    }
    setItem(id)
    show(kind)
  }
  return (
    <div
      ref={scene}
      className="tg-scene tg-scene--rail-bottom z-40"
      data-daypart={daypartOf(hour)}
      onPointerDownCapture={() => gardenAudio.ensure()}
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
          onParked={() => show('park')}
        />
      </div>
      <div className="tg-bubble-area">
        <Bubbles
          bubbles={state.buds.filter((b) => states[b.id])}
          slots={state.bubbleSlots}
          states={states}
          startedAt={Object.fromEntries(
            air.filter((s) => s.start && !s.end).map((s) => [s.id, s.start!]),
          )}
          onOpen={(id) => void clickBubble(id)}
          onHoldFinish={(id) => void completeRunning(id)}
          holdLocked={busy}
        />
      </div>
      <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3">
        <Flex gap="2" align="center">
          <StickerCard asChild interactive size="sm" tone="paper" elevation="sm">
            <Link href="/">← 首页</Link>
          </StickerCard>
          <span className="tg-logo">🌳 生命树</span>
        </Flex>
        <StickerCard size="sm" tone="paper">
          <Flex gap="2" align="center" wrap="wrap">
            <Button
              size="1"
              variant="soft"
              aria-label={sound ? '关闭声音' : '开启声音'}
              onClick={() => setSound(!sound)}
            >
              {sound ? '🔊' : '🔇'}
            </Button>
            <Badge ref={sunRef} color="amber">
              ☀️ {tree.sun}
            </Badge>
            <Badge ref={waterRef} color="sky">
              💧 {tree.water}
            </Badge>
            <Button asChild size="1" variant="soft">
              <Link href="/setting/time-tree">家长设置</Link>
            </Button>
          </Flex>
        </StickerCard>
      </header>
      <aside ref={rail} className="tg-stone-rail" aria-label="宝石与盲盒">
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
          registerPile={() => {}}
        />
        <StickerCard size="sm" tone="paper" className="mt-2 max-md:hidden">
          <Flex direction="column" gap="2">
            {nextWish && nextWish > tree.today && (
              <Text size="1" className="max-md:hidden">
                下次心愿 {nextWish}
              </Text>
            )}
            <Button color="violet" variant="soft" onClick={() => show('box')}>
              🎁 {tree.boxReady ? '打开盲盒' : '我的盲盒'}
            </Button>
            <Text size="1" className="max-md:hidden">
              再结 {12 - (tree.appleCount % 12)} 个学科苹果长出彩虹果
            </Text>
            {tree.apples.length > 0 && (
              <Button size="1" variant="soft" onClick={() => show('fruitList')}>
                摘果子（{tree.apples.length}）
              </Button>
            )}
          </Flex>
        </StickerCard>
      </aside>
      <div
        ref={dock}
        className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-3"
      >
        <StickerCard size="sm" tone="paper" elevation="sm" className="flex max-w-full flex-wrap justify-center gap-2">
          <Button
            loading={busy}
            onClick={async () => {
              const t = await run({ kind: 'school' })
              if (t && !t.steps.some((s) => s.slot !== null))
                notify(
                  t.steps.some((s) => s.end && s.planned === t.today)
                    ? '今天的作业做完啦'
                    : '今天没有待做的作业',
                )
            }}
          >
            {tree.afterSchool ? '补满泡泡' : '🫧 放学了'}
          </Button>
          <Button
            color="amber"
            disabled={busy || tree.sun < 8 || tree.magicDay === tree.today}
            onClick={async () => {
              if (await run({ kind: 'magic' })) gardenAudio.magic()
            }}
          >
            ☀️ 阳光魔法 · 8
          </Button>
          <Button asChild variant="soft">
            <Link href="/tasks/homework">作业管理</Link>
          </Button>
          <Button asChild variant="soft">
            <Link href="/today/calendar?view=homework">作业日历</Link>
          </Button>
        </StickerCard>
      </div>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 size-full"
      />
      {(api.message || notice) && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center"
        >
          <StickerCard size="sm">{api.message || notice}</StickerCard>
        </div>
      )}
      {step && (
        <StepPanel
          key={step.id}
          api={api}
          step={step}
          select={setStep}
          close={() => setStep(null)}
          onBeforeFinish={(current) => {
            bloomOrigin.current = { id: current.id, at: bubbleCenter(current.id) }
          }}
          onFinished={(finished, next, bloom) => {
            const saved = bloomOrigin.current?.id === finished.id ? bloomOrigin.current.at : null
            bloomOrigin.current = null
            if (bloom) sow(finished, next, true, saved)
            notify(doneNotice(finished))
          }}
        />
      )}
      <AppDialog
        open={!!dialog}
        closeDisabled={busy}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          {
            '': '生命树',
            park: '先不做',
            box: '🎁 我的盲盒',
            wish: '兑换心愿',
            apple: '摘苹果',
            flower: flower?.name,
            fruitList: '待摘的苹果',
          }[dialog] || '生命树'
        }
      >
        <Flex direction="column" gap="3">
          {dialog === 'park' && (
            <ParkedTasks steps={tree.steps} onSelect={(id) => {
              close()
              setStep(id)
            }} />
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
              <Button key={a.id} variant="soft" onClick={() => openItem('apple', a.id)}>
                {a.dateKey} · {a.kind === 'rainbow' ? '🌈 彩虹果' : SUBJECTS[a.kind].label + '苹果'}
              </Button>
            ))}
          {dialog === 'apple' &&
            fruit &&
            (fruit.kind === 'rainbow' ? (
              CORE_SUBJECTS.map((color) => (
                <Button
                  key={color}
                  loading={busy}
                  onClick={async () => {
                    const t = await run({ kind: 'pick', id: itemId, color })
                    if (t) show(t.boxReady ? 'box' : '')
                  }}
                >
                  🌈 放进{SUBJECTS[color].stone}
                </Button>
              ))
            ) : (
              <Button
                loading={busy}
                onClick={async () => {
                  if (await run({ kind: 'pick', id: itemId })) {
                    gardenAudio.reward()
                    close()
                  }
                }}
              >
                🍎 摘下苹果
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
