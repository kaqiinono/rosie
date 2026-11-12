'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppDialog, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextField } from '@rosie/ui/themes'
import TreeScene, { type ItemKind } from '@/components/tree-demo/garden/TreeScene'
import Sky, { daypartOf } from '@/components/tree-demo/garden/Sky'
import Bubbles, { type BubbleState } from '@/components/tree-demo/garden/Bubbles'
import StonePanel from '@/components/tree-demo/garden/StonePanel'
import { buildRegions } from '@/components/tree-demo/garden/layout'
import { CORE_SUBJECTS, SUBJECTS } from '@/components/tree-demo/garden/model'
import { gardenAudio } from '@/components/tree-demo/garden/audio'
import { GardenFx } from '@/components/tree-demo/garden/fx'
import { shift, timing } from '@/lib/time-tree/types'
import { sceneState } from './sceneState'
import { StepPanel, TreeWait } from './StepPanel'
import { useTimeTree } from './useTimeTree'
import '@/components/tree-demo/garden/garden.css'

const noHidden = new Set<string>()
export default function LiveTree() {
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
  const fx = useRef<GardenFx | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const state = useMemo(() => (tree ? sceneState(tree) : null), [tree])
  const regions = useMemo(() => (state ? buildRegions(state) : []), [state])
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
      scene.current?.style.setProperty(
        '--tg-tree-bottom',
        (dock.current?.offsetHeight ?? 64) + 'px',
      )
      effects.resize()
    })
    obs.observe(dock.current)
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

  async function clickBubble(id: string) {
    if (busy) return
    const s = air.find((x) => x.id === id)
    if (!s?.end) {
      setStep(id)
      return
    }
    const el = Array.from(
      scene.current?.querySelectorAll<HTMLElement>('[data-bubble-id]') ?? [],
    ).find((e) => e.dataset.bubbleId === id)
    const rect = el?.getBoundingClientRect()
    const result = await run({ kind: 'pop', id })
    if (!result) return
    gardenAudio.pop()
    if (rect && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      fx.current?.burst(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        SUBJECTS[s.subject].color,
      )
    setFresh(Object.fromEntries(s.stages.map((_, i) => [id + '#' + i, 'born' as const])))
    notify('🌸 ' + s.name + '完成啦！')
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
      className="tg-scene z-40"
      data-daypart={daypartOf(hour)}
      onPointerDownCapture={() => gardenAudio.ensure()}
    >
      <Sky daypart={daypartOf(hour)} />
      <div className="tg-tree-wrap">
        <TreeScene
          state={state}
          regions={regions}
          fresh={fresh}
          hidden={noHidden}
          onItem={openItem}
          onParked={() => show('park')}
        />
      </div>
      <div className="tg-bubble-area">
        <Bubbles
          bubbles={state.buds.filter((b) => states[b.id])}
          slots={state.bubbleSlots}
          states={states}
          onOpen={(id) => void clickBubble(id)}
        />
      </div>
      <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3">
        <Flex gap="2" align="center">
          <Button asChild variant="soft">
            <Link href="/">← 首页</Link>
          </Button>
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
            <Badge color="amber">☀️ {tree.sun}</Badge>
            <Badge color="sky">💧 {tree.water}</Badge>
            <Button asChild size="1" variant="soft">
              <Link href="/setting/time-tree">家长设置</Link>
            </Button>
          </Flex>
        </StickerCard>
      </header>
      <aside className="tg-stone-rail" aria-label="宝石与盲盒">
        <StonePanel
          state={state}
          thresholds={tree.rules}
          canExchange={canExchange && !busy}
          onExchange={() => show('wish')}
          registerPile={() => {}}
        />
        <StickerCard size="sm" tone="paper" className="mt-2">
          <Flex direction="column" gap="2">
            {nextWish && nextWish > tree.today && <Text size="1">下次心愿 {nextWish}</Text>}
            <Button color="violet" variant="soft" onClick={() => show('box')}>
              🎁 {tree.boxReady ? '打开盲盒' : '我的盲盒'}
            </Button>
            <Text size="1">再结 {12 - (tree.appleCount % 12)} 个学科苹果长出彩虹果</Text>
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
        className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-2 p-3"
      >
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
          onFinished={(s) =>
            notify(
              timing(s).startsWith('超时')
                ? '做完啦，点绿色泡泡开花'
                : timing(s) + ' · ☀️ +' + s.sun + ' · 💧 +' + s.water,
            )
          }
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
          {dialog === 'park' &&
            (tree.steps.some((s) => !s.skipped && !s.planned && !s.end) ? (
              tree.steps
                .filter((s) => !s.skipped && !s.planned && !s.end)
                .map((s) => (
                  <Button
                    key={s.id}
                    variant="soft"
                    onClick={() => {
                      close()
                      setStep(s.id)
                    }}
                  >
                    {s.name}
                  </Button>
                ))
            ) : (
              <Text>这里暂时没有作业。</Text>
            ))}
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
