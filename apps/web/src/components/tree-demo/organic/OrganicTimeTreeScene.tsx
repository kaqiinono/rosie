'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  BUBBLES,
  STONE_PILES,
  SUBJECTS,
  buildHistory,
  buildSevenDays,
  type BranchData,
  type SubjectKey,
  type TreeItem,
} from '../data'
import { Controls, DeferredHtml, usePrefersReducedMotion } from '../TimeTreeScene'
import {
  appleVariant,
  createGemMaterial,
  GEM_PRESETS,
  KEY_LIGHT_COLOR,
  KEY_LIGHT_DIR,
} from './gemMaterial'
import {
  BRANCH_HEIGHTS,
  BRANCH_LENGTH,
  BUBBLE_SPOTS,
  FIRST_ALPHA,
  HISTORY_HEIGHTS,
  HISTORY_LENGTH,
  PILE_SPOTS,
  pilePositions,
} from './layout'
import { OrganicTimeTreeWorld } from './world'

// 「有机版」时间树：材质、动效、物理全部在 organic/*.ts 里，本文件只是把它们摆进 R3F 场景树。
//
// 氛围（参考照片）：
//  · 背景 / 雾取同一个暖米色，远处自然「融」进薄雾，照片 2 的那种空气感；
//  · 一盏暖黄主光（KEY_LIGHT）+ 偏绿的半球天光 + 偏褐的地面反光 —— 三色光是「有机感」的底座，
//    纯白光 + 纯灰环境光会把任何材质都打回塑料。

const MIST = '#ece4cc'

export interface OrganicTreeApi {
  /** 0 点结算：最老的彩枝衰老、缩回，树干留下年轮涟漪 */
  rollover: () => boolean
  /** 新的一天：被收走的枝重新长出来 */
  newDay: () => boolean
  /** 摘一颗苹果，落到对应学科的石头堆 */
  pluck: (subject: SubjectKey) => boolean
}

export interface OrganicTimeTreeSceneProps {
  showHistory: boolean
  showBubbles: boolean
  resetSignal: number
  onApi: (api: OrganicTreeApi | null) => void
}

// ───────────────────────────── 花 / 苞 / 果 ─────────────────────────────

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h / 37
}

function Bud({ gray, cap }: { gray?: boolean; cap?: string }) {
  return (
    <group>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.02, 0.026, 0.32, 8]} />
        <meshStandardMaterial color={gray ? '#6f6a5e' : '#6a7a3c'} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.46, 0]} scale={[1, 1.3, 1]}>
        <sphereGeometry args={[0.17, 20, 16]} />
        <meshStandardMaterial color={gray ? '#a8a396' : '#a9c28b'} roughness={0.75} />
      </mesh>
      {cap && !gray ? (
        <mesh position={[0, -0.66, 0]}>
          <sphereGeometry args={[0.065, 12, 10]} />
          <meshStandardMaterial color={cap} roughness={0.5} />
        </mesh>
      ) : null}
    </group>
  )
}

function FlowerCluster({ count }: { count: number }) {
  return (
    <group position={[0, 0.3, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[(i - (count - 1) / 2) * 0.24, 0, 0]}>
          {Array.from({ length: 5 }, (_, j) => {
            const a = (j / 5) * Math.PI * 2
            return (
              <mesh key={j} position={[Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0]}>
                <sphereGeometry args={[0.085, 14, 10]} />
                <meshStandardMaterial color="#e6a8bd" roughness={0.65} />
              </mesh>
            )
          })}
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#e2c15d" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function AppleItem({
  world,
  id,
  subject,
}: {
  world: OrganicTimeTreeWorld
  id: string
  subject: SubjectKey | 'rainbow'
}) {
  const gem = useMemo(
    () =>
      createGemMaterial({
        preset: appleVariant(GEM_PRESETS[subject]),
        seed: hashId(id),
        radius: 0.26,
        apple: 1,
      }),
    [id, subject],
  )
  // 引用必须稳定，否则每次重渲染都会「取消注册 → 重新注册」，丢掉已摘状态。
  const register = useCallback(
    (object: THREE.Group | null) => {
      if (object) world.registerApple(id, subject, object)
      else world.unregisterApple(id)
    },
    [world, id, subject],
  )
  return (
    <group ref={register}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.026, 0.26, 8]} />
        <meshStandardMaterial color="#5a4a30" roughness={0.9} />
      </mesh>
      <mesh
        position={[0, -0.46, 0]}
        geometry={world.gemGeometry}
        material={gem.material}
        dispose={null}
      />
    </group>
  )
}

function ItemView({
  world,
  item,
  id,
}: {
  world: OrganicTimeTreeWorld
  item: TreeItem
  id: string
}) {
  switch (item.kind) {
    case 'bud':
      return <Bud cap={GEM_PRESETS[item.subject].light} />
    case 'grayBud':
      return <Bud gray />
    case 'flower':
      return <FlowerCluster count={item.count} />
    case 'apple':
      return <AppleItem world={world} id={id} subject={item.subject} />
    case 'rainbow':
      return <AppleItem world={world} id={id} subject="rainbow" />
  }
}

// ───────────────────────────── 树与枝 ─────────────────────────────

function Trunk({ world }: { world: OrganicTimeTreeWorld }) {
  return (
    <mesh
      geometry={world.trunkGeometry}
      material={world.trunk.material}
      frustumCulled={false}
      dispose={null}
    />
  )
}

function Ground() {
  return (
    <mesh position={[0, -0.22, 0]}>
      <cylinderGeometry args={[5.8, 6.2, 0.44, 64]} />
      <meshStandardMaterial color="#7b8752" roughness={1} />
    </mesh>
  )
}

interface BranchRigProps {
  world: OrganicTimeTreeWorld
  entryIndex: number
  data: BranchData
  alpha: number
  height: number
  rise: number
  length: number
  history?: boolean
}

function BranchRig({
  world,
  entryIndex,
  data,
  alpha,
  height,
  rise,
  length,
  history,
}: BranchRigProps) {
  const entry = world.branches[entryIndex]
  const setMesh = useCallback(
    (m: THREE.Mesh | null) => world.setBranchMesh(entryIndex, m),
    [world, entryIndex],
  )
  const setItems = useCallback(
    (g: THREE.Group | null) => world.setBranchItems(entryIndex, g),
    [world, entryIndex],
  )
  return (
    <group position={[0, height, 0]} rotation={[0, alpha - Math.PI / 2, 0]}>
      <group rotation={[0, 0, rise]}>
        <mesh
          ref={setMesh}
          geometry={entry.geometry}
          material={entry.bark.material}
          frustumCulled={false}
          dispose={null}
        />
        <group ref={setItems}>
          {data.items.map((item, k) => (
            <group key={k} position={[0.85 + k * 0.52, 0, 0]}>
              <ItemView world={world} item={item} id={`${entryIndex}-${k}`} />
            </group>
          ))}
        </group>
        {!history ? (
          <DeferredHtml
            position={[length + 0.25, 0.55, 0]}
            center
            pointerEvents="none"
            zIndexRange={[20, 0]}
          >
            <span
              className={
                'pointer-events-none flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold whitespace-nowrap select-none ' +
                (data.isToday
                  ? 'border-amber-600 bg-amber-300 text-amber-950'
                  : 'border-kid-line bg-white text-slate-800')
              }
            >
              <i
                className="inline-block size-2.5 rounded-full"
                style={{ background: data.color }}
              />
              {data.label}
            </span>
          </DeferredHtml>
        ) : null}
      </group>
    </group>
  )
}

// ───────────────────────────── 石头堆 ─────────────────────────────

function StoneMesh({
  world,
  subject,
  seed,
}: {
  world: OrganicTimeTreeWorld
  subject: SubjectKey
  seed: number
}) {
  const gem = useMemo(
    () => createGemMaterial({ preset: GEM_PRESETS[subject], seed, radius: 0.24 }),
    [subject, seed],
  )
  return <mesh geometry={world.gemGeometry} material={gem.material} dispose={null} />
}

function PileView({
  world,
  subject,
  count,
  shown,
}: {
  world: OrganicTimeTreeWorld
  subject: SubjectKey
  count: number
  shown: number
}) {
  const attach = useCallback(
    (g: THREE.Group | null) => world.attachPile(subject, g),
    [world, subject],
  )
  const offset = Object.keys(SUBJECTS).indexOf(subject) * 20
  return (
    <group position={PILE_SPOTS[subject]}>
      <group ref={attach}>
        {pilePositions(shown).map((p, i) => (
          <group key={i} position={p} rotation={[0, i * 0.8, 0]}>
            <StoneMesh world={world} subject={subject} seed={offset + i * 1.7 + 1} />
          </group>
        ))}
      </group>
      <DeferredHtml position={[0, -0.25, 0.9]} center pointerEvents="none" zIndexRange={[20, 0]}>
        <span className="border-kid-line pointer-events-none rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold whitespace-nowrap text-slate-800 select-none">
          {SUBJECTS[subject].stone} {count}
        </span>
      </DeferredHtml>
    </group>
  )
}

// ───────────────────────────── 泡泡 ─────────────────────────────

function BubbleView({
  world,
  index,
  animate,
}: {
  world: OrganicTimeTreeWorld
  index: number
  animate: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const base = BUBBLE_SPOTS[index]
  const data = BUBBLES[index]
  useFrame(({ clock }) => {
    if (!group.current || !animate) return
    group.current.position.y = base[1] + Math.sin(clock.elapsedTime * 0.9 + index * 1.7) * 0.14
    group.current.position.x = base[0] + Math.sin(clock.elapsedTime * 0.5 + index) * 0.06
  })
  return (
    <group ref={group} position={base}>
      <mesh
        geometry={world.bubbleGeometry}
        material={world.bubbles[index].handle.material}
        scale={0.85}
        renderOrder={5}
        frustumCulled={false}
        dispose={null}
      />
      <DeferredHtml center pointerEvents="none" zIndexRange={[20, 0]}>
        <div className="pointer-events-none flex w-20 flex-col items-center text-center text-xs leading-tight font-bold text-slate-800 select-none">
          <span className="border-kid-line mb-0.5 rounded-full border-2 bg-white px-1.5">
            {SUBJECTS[data.subject].label}
          </span>
          <span>{data.title}</span>
        </div>
      </DeferredHtml>
    </group>
  )
}

function Frame({ world }: { world: OrganicTimeTreeWorld }) {
  useFrame((_, dt) => world.update(Math.min(dt, 0.1)))
  return null
}

// ───────────────────────────── 入口 ─────────────────────────────

export default function OrganicTimeTreeScene({
  showHistory,
  showBubbles,
  resetSignal,
  onApi,
}: OrganicTimeTreeSceneProps) {
  const reduced = usePrefersReducedMotion()
  const days = useMemo(() => buildSevenDays(new Date()), [])
  const history = useMemo(() => buildHistory(new Date()), [])
  const world = useMemo(
    () =>
      new OrganicTimeTreeWorld({ branchColors: days.map((d) => d.color), reducedMotion: reduced }),
    [days, reduced],
  )
  const [counts, setCounts] = useState<Record<SubjectKey, number>>(() => ({
    chinese: world.piles.chinese.count,
    math: world.piles.math.count,
    english: world.piles.english.count,
    life: world.piles.life.count,
  }))

  useEffect(() => {
    world.setPileCountListener((subject, count) =>
      setCounts((prev) => ({ ...prev, [subject]: count })),
    )
    onApi({
      rollover: () => world.rollover(),
      newDay: () => world.newDay(),
      pluck: (subject) => world.pluck(subject),
    })
    return () => {
      onApi(null)
      world.setPileCountListener(undefined)
      world.dispose()
    }
  }, [world, onApi])

  const lightPos = useMemo(
    () => KEY_LIGHT_DIR.clone().multiplyScalar(16).toArray() as [number, number, number],
    [],
  )

  return (
    <Canvas camera={{ position: [0, 6, 15], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={[MIST]} />
      <fog attach="fog" args={[MIST, 30, 80]} />
      <hemisphereLight args={['#d2e3c0', '#6d5a3a', 1.0]} />
      <directionalLight position={lightPos} color={KEY_LIGHT_COLOR} intensity={2.6} />

      <Frame world={world} />
      <Ground />
      <Trunk world={world} />
      {days.map((day, i) => (
        <BranchRig
          key={day.offset}
          world={world}
          entryIndex={i}
          data={day}
          alpha={((FIRST_ALPHA + (i * 360) / 7) * Math.PI) / 180}
          height={BRANCH_HEIGHTS[i]}
          rise={0.22}
          length={BRANCH_LENGTH}
        />
      ))}
      {showHistory
        ? history.map((day, i) => (
            <BranchRig
              key={day.offset}
              world={world}
              entryIndex={days.length + i}
              data={day}
              alpha={((FIRST_ALPHA + ((i * 2 + 0.5) * 360) / 7 + 12) * Math.PI) / 180}
              height={HISTORY_HEIGHTS[i]}
              rise={-0.1}
              length={HISTORY_LENGTH}
              history
            />
          ))
        : null}

      {STONE_PILES.map((p) => (
        <PileView
          key={p.subject}
          world={world}
          subject={p.subject}
          count={counts[p.subject]}
          shown={p.count}
        />
      ))}

      {showBubbles
        ? BUBBLES.map((_, i) => <BubbleView key={i} world={world} index={i} animate={!reduced} />)
        : null}

      <mesh
        ref={(m) => world.setRippleObject(m)}
        geometry={world.rippleGeometry}
        material={world.ripple.material}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={2.3}
        visible={false}
        renderOrder={6}
        frustumCulled={false}
        dispose={null}
      />
      <primitive object={world.fruitRoot} />
      <Controls resetSignal={resetSignal} />
    </Canvas>
  )
}
