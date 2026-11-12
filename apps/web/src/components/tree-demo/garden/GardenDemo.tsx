'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { StickerCard } from '@rosie/ui'
import { Badge, Button, IconButton, Text } from '@rosie/ui/themes'
import Bubbles from './Bubbles'
import {
  BudDialog,
  BubbleDialog,
  DiaryDialog,
  ExchangeDialog,
  HelpDialog,
  ParentDialog,
  ParkedDialog,
  RainbowDialog,
  type RainbowStage,
} from './GardenDialogs'
import Sky, { daypartOf, type Daypart } from './Sky'
import StonePanel from './StonePanel'
import TreeScene, { type FreshKind, type ItemKind, type TreeSceneHandle } from './TreeScene'
import { gardenAudio } from './audio'
import { GardenFx } from './fx'
import { buildRegions, todayCenter } from './layout'
import {
  COMBO_EVERY,
  GOAL_POPS,
  GOAL_WATER_BONUS,
  MAGIC_COST,
  SUBJECTS,
  type CoreSubject,
  type SubjectKey,
} from './model'
import { GardenStore } from './store'
import './garden.css'

type DaypartMode = 'auto' | Daypart

interface Toast {
  id: number
  text: string
}
interface FloatText {
  id: number
  x: number
  y: number
  text: string
}

const PRIZES = ['冰淇淋一个', '动画片加时 20 分钟', '妈妈多讲 2 个睡前故事', '这个周末你来选去哪玩', '选一道今晚的菜']

const DAYPART_OPTIONS = [
  { value: 'auto', label: '跟随当前时间' },
  { value: 'morning', label: '早晨' },
  { value: 'day', label: '白天' },
  { value: 'dusk', label: '傍晚' },
  { value: 'night', label: '夜晚' },
]

function bump(el: HTMLElement | null): void {
  if (!el) return
  el.classList.remove('tg-bump')
  void el.offsetWidth
  el.classList.add('tg-bump')
}

export default function GardenDemo() {
  const [store] = useState(() => new GardenStore())
  const [fx] = useState(() => new GardenFx())
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const regions = useMemo(() => buildRegions(state), [state])

  const sceneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<TreeSceneHandle>(null)
  const sunRef = useRef<HTMLSpanElement>(null)
  const waterRef = useRef<HTMLSpanElement>(null)
  const pileEls = useRef<Partial<Record<SubjectKey, HTMLElement>>>({})
  const idCounter = useRef(0)

  const [mode, setMode] = useState<DaypartMode>('auto')
  const [hour, setHour] = useState(() => new Date().getHours())
  const daypart: Daypart = mode === 'auto' ? daypartOf(hour) : mode
  const [sound, setSound] = useState(true)

  const [fresh, setFresh] = useState<Record<string, FreshKind>>({})
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [floats, setFloats] = useState<FloatText[]>([])

  const [bubbleId, setBubbleId] = useState<string | null>(null)
  const [budId, setBudId] = useState<string | null>(null)
  const [showParked, setShowParked] = useState(false)
  const [showDiary, setShowDiary] = useState(false)
  const [showParent, setShowParent] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [rainbow, setRainbow] = useState<RainbowStage | null>(null)

  // ---------- 画布、时间、尺寸 ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fx.attach(canvas, () => treeRef.current?.crownRect() ?? null)
    const scene = sceneRef.current
    const dock = dockRef.current
    const observer = scene
      ? new ResizeObserver(() => {
          fx.resize()
          // 树根站在底部功能坞的上沿，坞多高树就抬多高
          if (dock) scene.style.setProperty('--tg-tree-bottom', `${Math.max(dock.offsetHeight - 8, 0)}px`)
        })
      : null
    if (scene && observer) {
      observer.observe(scene)
      if (dock) observer.observe(dock)
    }
    return () => {
      observer?.disconnect()
      fx.detach()
      gardenAudio.dispose()
    }
  }, [fx])

  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    fx.setNight(daypart === 'night')
  }, [fx, daypart])

  useEffect(() => {
    gardenAudio.setSound(sound)
  }, [sound])

  // ---------- 小工具 ----------
  const toast = useCallback((text: string) => {
    idCounter.current += 1
    const id = idCounter.current
    setToasts((prev) => [...prev.slice(-2), { id, text }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  const addFloat = useCallback((x: number, y: number, text: string) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    idCounter.current += 1
    const id = idCounter.current
    setFloats((prev) => [...prev, { id, x: x - (rect?.left ?? 0), y: y - (rect?.top ?? 0), text }])
    window.setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1200)
  }, [])

  const markFresh = useCallback((ids: string[], kind: FreshKind, ms: number) => {
    setFresh((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = kind
      return next
    })
    window.setTimeout(() => {
      setFresh((prev) => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
    }, ms)
  }, [])

  const flyTo = useCallback(
    (el: HTMLElement | null | undefined, x: number, y: number, color: string, r: number) => {
      if (!el) return
      const b = el.getBoundingClientRect()
      fx.orb(x, y, b.left + b.width / 2, b.top + b.height / 2, color, r, 0.85, () => bump(el))
    },
    [fx],
  )

  /** 某个物件当前在屏幕上的位置（视口坐标） */
  const clientPosOf = useCallback(
    (id: string): { x: number; y: number } | null => {
      for (const r of buildRegions(store.getState())) {
        const hit = r.placed.find((p) => p.item.id === id)
        if (hit) return treeRef.current?.toClient(hit.x, hit.y) ?? null
      }
      const c = todayCenter()
      return treeRef.current?.toClient(c.x, c.y) ?? null
    },
    [store],
  )

  // ---------- 动作 ----------
  function handleAfterSchool(): void {
    gardenAudio.ensure()
    const n = store.startAfterSchool()
    if (n === 0) {
      toast(store.getState().bubbles.length >= 4 ? '空中已经有 4 个泡泡了，先戳破一个吧' : '今天没有可做的花苞，先把事情挪到今天')
    } else {
      gardenAudio.bloom()
      toast(`🫧 ${n} 个泡泡飞出来啦`)
    }
  }

  function handlePop(id: string): void {
    const el = sceneRef.current?.querySelector<HTMLElement>(`[data-bubble-id="${id}"]`)
    const rect = el?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : 160
    const res = store.pop(id)
    if (!res) return
    setBubbleId(null)
    gardenAudio.pop()
    if (!fx.prefersReducedMotion()) {
      fx.burst(cx, cy, SUBJECTS[res.bud.subject].color)
      flyTo(sunRef.current, cx, cy, '#ffd54a', 7)
      flyTo(waterRef.current, cx, cy + 12, '#74c0fc', 7)
    }
    addFloat(cx, cy - 60, `+${res.sunGain}☀️  +${res.waterGain}💧`)
    if (res.combo > 1) addFloat(cx, cy - 92, `连击 ×${res.combo}!`)
    if (res.comboWater) toast(`⚡ ${COMBO_EVERY} 连击！奖励 💧+1`)
    if (res.goalReached) {
      toast(`🎯 今日目标达成！奖励 💧+${GOAL_WATER_BONUS}`)
      window.setTimeout(() => fx.confetti(cx, cy + 40), 500)
    }
    if (res.streakDay !== null && res.streakDay > 1) toast(`🔥 连续 ${res.streakDay} 天完成作业，太厉害了！`)

    // 种子飞向今天的叶区，到了才开花
    const ids = res.flowers.map((f) => f.id)
    setHidden((prev) => new Set([...prev, ...ids]))
    fx.flySeeds(
      cx,
      cy,
      res.flowers.map((f) => {
        const target = clientPosOf(f.id) ?? { x: cx, y: cy - 200 }
        return { id: f.id, x: target.x, y: target.y }
      }),
      (seed) => {
        setHidden((prev) => {
          const next = new Set(prev)
          next.delete(seed.id)
          return next
        })
        markFresh([seed.id], 'born', 800)
      },
    )
  }

  function handleWater(id: string, rect: DOMRect): void {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const result = store.waterFlower(id)
    if (result === 'ok') {
      gardenAudio.water()
      fx.droplets(cx, cy)
      markFresh([id], 'wiggle', 620)
      bump(waterRef.current)
      const f = store.getState().flowers.find((x) => x.id === id)
      if (f && f.stage >= 3) {
        gardenAudio.ripen()
        fx.petals(cx, cy, 9)
        fx.sparkle(cx, cy, 8, '#ffc9de')
        toast('🌸 盛开啦！')
      }
    } else if (result === 'no-water') {
      toast('💧 没有水滴啦，去戳泡泡就有')
    } else if (result === 'full') {
      toast('这朵花已经盛开啦 🌸')
    }
  }

  function handleApple(id: string, rect: DOMRect): void {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const res = store.pickApple(id)
    if (!res) return
    gardenAudio.pick()
    if (res.apple.kind === 'rainbow') {
      fx.burst(cx, cy, '#a855f7')
      fx.confetti(cx, cy)
      setRainbow({ step: 'assign' })
      return
    }
    const kind = res.apple.kind
    const meta = SUBJECTS[kind]
    flyTo(pileEls.current[kind], cx, cy, meta.color, 9)
    fx.sparkle(cx, cy, 8, '#ffe082')
    addFloat(cx, cy - 30, `+1 ${meta.stone}`)
  }

  function handleItem(kind: ItemKind, id: string, rect: DOMRect): void {
    gardenAudio.ensure()
    if (kind === 'bud') {
      gardenAudio.click()
      setBudId(id)
    } else if (kind === 'flower') {
      handleWater(id, rect)
    } else {
      handleApple(id, rect)
    }
  }

  function handleMagic(): void {
    gardenAudio.ensure()
    const res = store.castMagic()
    if (!res.ok) {
      toast(res.reason === 'sun' ? `☀️ 阳光不够（需要 ${MAGIC_COST}），先戳几个泡泡吧` : '现在没有需要长大的花 🌸')
      return
    }
    gardenAudio.magic()
    markFresh(res.ids, 'wiggle', 700)
    res.ids.forEach((id, i) => {
      window.setTimeout(() => {
        const p = clientPosOf(id)
        if (p) fx.sparkle(p.x, p.y, 6, '#ffe082')
      }, 150 + i * 120)
    })
    toast(`✨ 阳光魔法！${res.ids.length} 朵花一起长大`)
  }

  function handleMidnight(): void {
    gardenAudio.ensure()
    setBubbleId(null)
    setBudId(null)
    const report = store.simulateMidnight()
    gardenAudio.midnight()
    markFresh(
      report.apples.map((a) => a.id),
      'born',
      900,
    )
    const crown = treeRef.current?.crownRect()
    if (crown) {
      const x = crown.left + crown.width / 2
      const y = crown.top + crown.height * 0.4
      fx.sparkle(x, y, 14, '#ffe082')
      if (report.rainbow > 0) fx.confetti(x, y)
    }
    const bits = [`结出 ${report.apples.length} 个苹果`]
    if (report.rainbow > 0) bits.push(`其中 ${report.rainbow} 个彩虹果`)
    if (report.newOverdue > 0) bits.push(`${report.newOverdue} 个花苞变灰`)
    if (report.lapsedBubbles > 0) bits.push(`${report.lapsedBubbles} 个泡泡变回花苞`)
    toast(`🌙 过了 0 点：${bits.join('，')}`)
  }

  function handleAssign(subject: CoreSubject): void {
    store.assignRainbow(subject)
    gardenAudio.reward()
    setRainbow({ step: 'box', prize: PRIZES[Math.floor(Math.random() * PRIZES.length)], subject })
  }

  function handleExchange(): void {
    if (!store.exchange()) return
    setShowExchange(false)
    gardenAudio.reward()
    const pile = pileEls.current.chinese
    const b = pile?.getBoundingClientRect()
    if (b) fx.confetti(b.left + b.width / 2, b.top)
    toast('🎁 兑换成功！把心愿告诉爸爸妈妈吧')
  }

  function handleMove(id: string, key: string | null): void {
    const res = store.moveBud(id, key)
    if (res === 'full') toast('这一天已经排满啦，换一天试试')
    else if (res === 'blocked') toast('空中的泡泡不能挪，先戳破它')
    else {
      gardenAudio.click()
      setBudId(null)
      toast(key === null ? '放进「先不做」了' : '已经挪到新的一天')
    }
  }

  function handleReset(): void {
    store.reset()
    setFresh({})
    setHidden(new Set())
    setBubbleId(null)
    setBudId(null)
    toast('已重置成初始样例')
  }

  const bubbleBuds = state.bubbles.flatMap((id) => state.buds.find((b) => b.id === id) ?? [])
  const bubbleBud = state.buds.find((b) => b.id === bubbleId) ?? null
  const dialogBud = state.buds.find((b) => b.id === budId) ?? null
  const canExchange = store.canExchange()

  return (
    <>
      <div
        ref={sceneRef}
        data-daypart={daypart}
        className="tg-scene z-40"
        onPointerDownCapture={() => gardenAudio.ensure()}
      >
        <Sky daypart={daypart} />

        {/* 大树：占满整个屏幕中部 */}
        <div className="tg-tree-wrap">
          <TreeScene
            ref={treeRef}
            state={state}
            regions={regions}
            fresh={fresh}
            hidden={hidden}
            onItem={handleItem}
            onParked={() => setShowParked(true)}
          />
        </div>

        {/* 泡泡：飘在树旁边和上方 */}
        <div className="tg-bubble-area">
          <Bubbles bubbles={bubbleBuds} slots={state.bubbleSlots} onOpen={(id) => setBubbleId(id)} />
        </div>
        {bubbleBuds.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-4">
            <StickerCard tone="paper" size="sm" elevation="sm" radius="md">
              <Text size="2" weight="bold" color="gray">
                {state.afterSchool ? '泡泡都戳破啦！点树上的花苞，可以再放一个泡泡' : '放学以后点「放学了」，今天的泡泡就会飘出来'}
              </Text>
            </StickerCard>
          </div>
        )}

        {/* 顶栏：标题、阳光水滴、连续天数、年轮、今日目标 */}
        <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <IconButton asChild size="2" variant="soft" color="gray" aria-label="返回首页">
              <Link href="/">←</Link>
            </IconButton>
            <span className="tg-logo">🌳 时间成长树</span>
          </div>
          <StickerCard tone="paper" size="none" elevation="sm" radius="md" className="flex flex-wrap items-center justify-end gap-1.5 px-2 py-1.5">
            <Badge ref={sunRef} size="3" color="amber" variant="soft" radius="full" title="阳光：每开一朵花得 2 个，用来施展阳光魔法">
              ☀️ {state.sun}
            </Badge>
            <Badge ref={waterRef} size="3" color="sky" variant="soft" radius="full" title="水滴：点开花的小花浇水">
              💧 {state.water}
            </Badge>
            <Badge size="3" color="orange" variant="soft" radius="full" title="连续完成作业的天数，只展示，不惩罚">
              🔥 {state.streak} 天
            </Badge>
            <Badge size="3" color="brown" variant="soft" radius="full" title="年轮：已经收起的空历史叶区">
              🌳 {state.rings}
            </Badge>
            <Badge size="3" color="pink" variant="soft" radius="full" title={`今日目标：戳破 ${GOAL_POPS} 个泡泡，领 ${GOAL_WATER_BONUS} 滴水`}>
              🎯 {Math.min(state.popsToday, GOAL_POPS)}/{GOAL_POPS}
            </Badge>
            <IconButton
              size="2"
              variant="soft"
              color="gray"
              aria-label={sound ? '关闭声音' : '开启声音'}
              onClick={() => setSound((v) => !v)}
            >
              {sound ? '🔊' : '🔇'}
            </IconButton>
            <IconButton size="2" variant="soft" color="gray" aria-label="怎么玩" onClick={() => setShowHelp(true)}>
              ❓
            </IconButton>
            <Button size="2" variant="soft" color="gray" onClick={() => setShowParent(true)}>
              🔒 家长
            </Button>
          </StickerCard>
        </header>

        <aside className="tg-stone-rail" aria-label="宝石收藏">
          <StonePanel
            state={state}
            canExchange={canExchange}
            onExchange={() => setShowExchange(true)}
            registerPile={(key, el) => {
              if (el) pileEls.current[key] = el
              else delete pileEls.current[key]
            }}
          />
        </aside>

        <div ref={dockRef} className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 p-3">
          <Button size="3" onClick={handleAfterSchool}>
            🫧 {state.afterSchool ? '补满泡泡' : '放学了'}
          </Button>
          <Button size="3" color="amber" onClick={handleMagic}>
            ✨ 阳光魔法 {MAGIC_COST}☀️
          </Button>
          <Button size="3" color="sky" onClick={() => setShowDiary(true)}>
            📔 成长日记
          </Button>
          <Button size="3" color="gray" onClick={handleMidnight}>
            🌙 模拟过 0 点
          </Button>
        </div>

        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
          {floats.map((f) => (
            <span key={f.id} className="tg-float-text" style={{ left: f.x, top: f.y }}>
              {f.text}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-36 z-30 flex flex-col items-center gap-2 px-3" aria-live="polite">
          {toasts.map((t) => (
            <StickerCard key={t.id} tone="paper" size="sm" elevation="sm" radius="md" className="tg-toast max-w-full">
              <Text size="2" weight="bold">
                {t.text}
              </Text>
            </StickerCard>
          ))}
        </div>
      </div>

      <HelpDialog
        open={showHelp}
        skyValue={mode}
        skyOptions={DAYPART_OPTIONS}
        onSkyChange={(v) => setMode(v as DaypartMode)}
        pity={state.pity}
        k={state.settings.k}
        n={state.settings.n}
        onReset={handleReset}
        onClose={() => setShowHelp(false)}
      />
      <BubbleDialog
        bud={bubbleBud}
        onClose={() => setBubbleId(null)}
        onPop={() => bubbleBud && handlePop(bubbleBud.id)}
        onPutBack={() => {
          if (bubbleBud) store.removeBubble(bubbleBud.id)
          setBubbleId(null)
        }}
      />
      <BudDialog
        bud={dialogBud}
        state={state}
        canBubble={dialogBud ? store.canAddBubble(dialogBud.id) : false}
        onClose={() => setBudId(null)}
        onAddBubble={() => {
          if (dialogBud && store.addBubble(dialogBud.id)) {
            gardenAudio.bloom()
            toast('🫧 放进泡泡啦')
            setBudId(null)
          }
        }}
        onMove={(key) => dialogBud && handleMove(dialogBud.id, key)}
      />
      <ParkedDialog open={showParked} state={state} onClose={() => setShowParked(false)} onMove={handleMove} />
      <DiaryDialog
        open={showDiary}
        entries={state.diary}
        totalPops={state.totalPops}
        rings={state.rings}
        exchanges={state.exchanges}
        onClose={() => setShowDiary(false)}
      />
      <RainbowDialog stage={rainbow} state={state} onAssign={handleAssign} onClose={() => setRainbow(null)} />
      <ExchangeDialog
        open={showExchange}
        n={state.settings.n}
        onConfirm={handleExchange}
        onClose={() => setShowExchange(false)}
      />
      <ParentDialog
        open={showParent}
        settings={state.settings}
        onChange={(patch) => store.setSettings(patch)}
        onClose={() => setShowParent(false)}
      />
    </>
  )
}
