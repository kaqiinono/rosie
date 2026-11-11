'use client'

import { Billboard, Html, OrbitControls, Outlines } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from 'react'
import * as THREE from 'three'
import {
  BUBBLES,
  SUBJECTS,
  STONE_PILES,
  TRUNK_RINGS,
  buildHistory,
  buildSevenDays,
  type BranchData,
  type SubjectKey,
  type TreeItem,
} from './data'

// 「软糖贴纸」的立体版：纯色 + 深色粗描边 + 三档色阶（无渐变）。
const INK = '#5b3a1e'
const BARK = '#a0673c'
const BARK_DARK = '#7c4a24'
const LEAF = '#4ade80'
const LEAF_DARK = '#22c55e'
const BUD = '#6ee7a0'
const GRAY_BUD = '#9ca3af'
const STEM = '#65a30d'
const PETAL = '#f472b6'
const FLOWER_CORE = '#fde047'
const RAINBOW_BANDS = ['#ef4444', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#818cf8', '#c084fc']

const TRUNK_HEIGHT = 5.4
const TRUNK_R_BOTTOM = 0.62
const TRUNK_R_TOP = 0.4
const BRANCH_LENGTH = 2.9
const TREE_TARGET: [number, number, number] = [0, 4.1, 0]

// 三档色阶的贴图：让光照呈现为平涂的三块色，而不是平滑渐变。
let gradientMap: THREE.DataTexture | null = null
function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    gradientMap = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat)
    gradientMap.minFilter = THREE.NearestFilter
    gradientMap.magFilter = THREE.NearestFilter
    gradientMap.generateMipmaps = false
    gradientMap.needsUpdate = true
  }
  return gradientMap
}

function Toon({ color, opacity }: { color: string; opacity?: number }) {
  return (
    <meshToonMaterial
      color={color}
      gradientMap={getGradientMap()}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  )
}

function Ink({ t = 0.03, color = INK }: { t?: number; color?: string }) {
  return <Outlines thickness={t} color={color} />
}

// drei 的 Html 在开发模式下首个标签偶尔渲染为空，延后一拍再挂载即可避开。
export const DeferredHtml = forwardRef<HTMLDivElement, ComponentProps<typeof Html>>(
  function DeferredHtml(props, ref) {
    const [ready, setReady] = useState(false)
    useEffect(() => {
      const id = window.setTimeout(() => setReady(true), 80)
      return () => window.clearTimeout(id)
    }, [])
    return ready ? <Html ref={ref} {...props} /> : null
  },
)

function trunkRadiusAt(y: number): number {
  return TRUNK_R_BOTTOM - (TRUNK_R_BOTTOM - TRUNK_R_TOP) * (y / TRUNK_HEIGHT)
}

function Trunk() {
  return (
    <group>
      <mesh position={[0, TRUNK_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[TRUNK_R_TOP, TRUNK_R_BOTTOM, TRUNK_HEIGHT, 20]} />
        <Toon color={BARK} />
        <Ink t={0.04} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[TRUNK_R_BOTTOM, 0.95, 0.5, 20]} />
        <Toon color={BARK} />
        <Ink t={0.04} />
      </mesh>
      {/* 年轮：已经收进树干的空历史枝 */}
      {Array.from({ length: TRUNK_RINGS }, (_, i) => {
        const y = 0.85 + i * 0.4
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[trunkRadiusAt(y) + 0.015, 0.035, 8, 32]} />
            <Toon color={BARK_DARK} />
          </mesh>
        )
      })}
    </group>
  )
}

function Crown() {
  const blobs: { p: [number, number, number]; r: number; c: string }[] = [
    { p: [0, 6.0, 0], r: 1.55, c: LEAF },
    { p: [-1.15, 5.6, 0.4], r: 1.05, c: LEAF_DARK },
    { p: [1.15, 5.7, -0.3], r: 1.15, c: LEAF_DARK },
    { p: [0.3, 5.5, 1.1], r: 0.95, c: LEAF },
    { p: [-0.4, 5.6, -1.1], r: 0.95, c: LEAF },
  ]
  return (
    <group>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p}>
          <sphereGeometry args={[b.r, 20, 16]} />
          <Toon color={b.c} />
          <Ink t={0.05} />
        </mesh>
      ))}
    </group>
  )
}

function Ground() {
  return (
    <group>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[5.6, 5.8, 0.44, 56]} />
        <Toon color="#86efac" />
        <Ink t={0.05} />
      </mesh>
    </group>
  )
}

function Bud({ gray, cap }: { gray?: boolean; cap?: string }) {
  return (
    <group>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.32, 6]} />
        <Toon color={gray ? '#6b7280' : STEM} />
      </mesh>
      <mesh position={[0, -0.46, 0]} scale={[1, 1.3, 1]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <Toon color={gray ? GRAY_BUD : BUD} />
        <Ink t={0.025} />
      </mesh>
      {cap && !gray ? (
        <mesh position={[0, -0.66, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <Toon color={cap} />
        </mesh>
      ) : null}
    </group>
  )
}

function Flower() {
  return (
    <group>
      {Array.from({ length: 5 }, (_, j) => {
        const a = (j / 5) * Math.PI * 2
        return (
          <mesh key={j} position={[Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0]}>
            <sphereGeometry args={[0.085, 12, 10]} />
            <Toon color={PETAL} />
            <Ink t={0.02} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, 0.03]}>
        <sphereGeometry args={[0.075, 12, 10]} />
        <Toon color={FLOWER_CORE} />
        <Ink t={0.02} />
      </mesh>
    </group>
  )
}

function FlowerCluster({ count }: { count: number }) {
  return (
    <group position={[0, 0.3, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <Billboard key={i} position={[(i - (count - 1) / 2) * 0.24, 0, 0]}>
          <Flower />
        </Billboard>
      ))}
    </group>
  )
}

function Apple({ color, rainbow }: { color?: string; rainbow?: boolean }) {
  const rainbowGeometry = useMemo(() => {
    if (!rainbow) return null
    const geometry = new THREE.SphereGeometry(0.27, 24, 18)
    const position = geometry.attributes.position
    const colors: number[] = []
    for (let i = 0; i < position.count; i++) {
      const t = (position.getY(i) / 0.27 + 1) / 2
      const band = Math.min(RAINBOW_BANDS.length - 1, Math.floor((1 - t) * RAINBOW_BANDS.length))
      const c = new THREE.Color(RAINBOW_BANDS[band])
      colors.push(c.r, c.g, c.b)
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [rainbow])

  return (
    <group>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.24, 6]} />
        <Toon color={BARK_DARK} />
      </mesh>
      <mesh position={[0.1, -0.2, 0]} rotation={[0, 0, -0.5]} scale={[1.6, 0.6, 1]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Toon color={LEAF_DARK} />
      </mesh>
      <mesh position={[0, -0.46, 0]} scale={[1, 0.92, 1]} geometry={rainbowGeometry ?? undefined}>
        {rainbow ? null : <sphereGeometry args={[0.27, 24, 18]} />}
        {rainbow ? (
          <meshToonMaterial vertexColors gradientMap={getGradientMap()} />
        ) : (
          <Toon color={color ?? '#ef4444'} />
        )}
        <Ink t={0.03} />
      </mesh>
      {rainbow ? (
        <mesh position={[0, -0.46, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.4, 0.028, 8, 36]} />
          <Toon color={FLOWER_CORE} />
        </mesh>
      ) : null}
    </group>
  )
}

function ItemView({ item }: { item: TreeItem }) {
  switch (item.kind) {
    case 'bud':
      return <Bud cap={SUBJECTS[item.subject].apple} />
    case 'grayBud':
      return <Bud gray />
    case 'flower':
      return <FlowerCluster count={item.count} />
    case 'apple':
      return <Apple color={SUBJECTS[item.subject].apple} />
    case 'rainbow':
      return <Apple rainbow />
  }
}

interface BranchProps {
  data: BranchData
  alpha: number
  height: number
  length: number
  rise: number
  history?: boolean
}

const SCRATCH_ANCHOR = new THREE.Vector3()
const SCRATCH_CAMERA = new THREE.Vector3()
const TARGET_VECTOR = new THREE.Vector3(...TREE_TARGET)

/** 标签在树的背面时淡出，避免前后枝的标签互相盖住。 */
function useFadeWhenBehind() {
  const anchor = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const faded = useRef(false)
  useFrame(({ camera }) => {
    if (!anchor.current || !label.current) return
    anchor.current.getWorldPosition(SCRATCH_ANCHOR).sub(TARGET_VECTOR)
    SCRATCH_CAMERA.copy(camera.position).sub(TARGET_VECTOR)
    const behind = SCRATCH_ANCHOR.dot(SCRATCH_CAMERA) < -0.5
    if (behind !== faded.current) {
      faded.current = behind
      label.current.style.opacity = behind ? '0.3' : '1'
    }
  })
  return { anchor, label }
}

function Branch({ data, alpha, height, length, rise, history }: BranchProps) {
  const rBase = history ? 0.11 : 0.2
  const rTip = history ? 0.06 : 0.1
  const { anchor, label } = useFadeWhenBehind()
  return (
    <group position={[0, height, 0]} rotation={[0, alpha - Math.PI / 2, 0]}>
      <group rotation={[0, 0, rise]}>
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rBase, rTip, length, 12]} />
          <Toon color={data.color} />
          <Ink t={history ? 0.02 : 0.03} />
        </mesh>
        {!history ? (
          <group position={[length, 0, 0]}>
            {[
              [0, 0.05, 0, 0.3],
              [0.12, 0.2, 0.18, 0.22],
              [0.1, 0.18, -0.2, 0.2],
            ].map(([x, y, z, r], i) => (
              <mesh key={i} position={[x, y, z]}>
                <sphereGeometry args={[r, 12, 10]} />
                <Toon color={i === 0 ? LEAF : LEAF_DARK} />
                <Ink t={0.03} />
              </mesh>
            ))}
          </group>
        ) : null}
        {data.items.map((item, k) => (
          <group key={k} position={[0.85 + k * 0.52, 0, 0]}>
            <ItemView item={item} />
          </group>
        ))}
        <group ref={anchor} position={[length + 0.25, 0.55, 0]} />
        <DeferredHtml
          ref={label}
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
                : history
                  ? 'border-stone-400 bg-stone-100 text-stone-600'
                  : 'border-kid-line bg-white text-slate-800')
            }
          >
            {/* 彩枝颜色圆点：和星期绑定，仅作识别 */}
            <i className="inline-block size-2.5 rounded-full" style={{ background: data.color }} />
            {data.label}
          </span>
        </DeferredHtml>
      </group>
    </group>
  )
}

const BRANCH_HEIGHTS = [3.3, 3.9, 4.5, 3.6, 4.2, 4.8, 3.0]
const HISTORY_HEIGHTS = [2.3, 2.7, 1.95, 2.45]
const FIRST_ALPHA = -75

function pilePositions(count: number): [number, number, number][] {
  const rows = [3, 2, 1]
  const out: [number, number, number][] = []
  let layer = 0
  while (out.length < count) {
    const size = rows[layer % rows.length]
    for (let j = 0; j < size && out.length < count; j++) {
      out.push([(j - (size - 1) / 2) * 0.5, 0.2 + layer * 0.34, ((layer + j) % 2) * 0.08])
    }
    layer++
  }
  return out
}

function Gem({ subject }: { subject: SubjectKey }) {
  const color = SUBJECTS[subject].apple
  switch (subject) {
    case 'chinese':
      return (
        <mesh>
          <dodecahedronGeometry args={[0.24, 0]} />
          <Toon color={color} />
          <Ink t={0.03} />
        </mesh>
      )
    case 'math':
      return (
        <mesh scale={[1, 1.15, 1]}>
          <octahedronGeometry args={[0.28, 0]} />
          <Toon color={color} />
          <Ink t={0.03} />
        </mesh>
      )
    case 'english':
      return (
        <mesh>
          <icosahedronGeometry args={[0.26, 0]} />
          <Toon color={color} />
          <Ink t={0.03} />
        </mesh>
      )
    default:
      return (
        <mesh>
          <sphereGeometry args={[0.2, 14, 10]} />
          <Toon color="#2dd4bf" />
          <Ink t={0.03} />
        </mesh>
      )
  }
}

const PILE_SPOTS: Record<SubjectKey, [number, number, number]> = {
  chinese: [-1.9, 0, 2.9],
  math: [0, 0, 3.1],
  english: [1.9, 0, 2.9],
  life: [3.7, 0, 1.7],
}

function Stones() {
  return (
    <group>
      {STONE_PILES.map((pile) => (
        <group key={pile.subject} position={PILE_SPOTS[pile.subject]}>
          {pilePositions(pile.count).map((p, i) => (
            <group key={i} position={p} rotation={[0, i * 0.8, 0]}>
              <Gem subject={pile.subject} />
            </group>
          ))}
          <DeferredHtml
            position={[0, -0.25, 0.9]}
            center
            pointerEvents="none"
            zIndexRange={[20, 0]}
          >
            <span className="border-kid-line pointer-events-none rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold whitespace-nowrap text-slate-800 select-none">
              {SUBJECTS[pile.subject].stone} {pile.count}
            </span>
          </DeferredHtml>
        </group>
      ))}
    </group>
  )
}

const BUBBLE_SPOTS: [number, number, number][] = [
  [-3.3, 7.9, 0.8],
  [-1.15, 8.7, 1.5],
  [1.3, 8.0, 0.3],
  [3.4, 8.8, 1.1],
]

function Bubble({ index, animate }: { index: number; animate: boolean }) {
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
      <mesh>
        <sphereGeometry args={[0.85, 28, 20]} />
        <Toon color="#bae6fd" opacity={0.42} />
        <Ink t={0.035} color="#0ea5e9" />
      </mesh>
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

export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  return reduced
}

type OrbitHandle = ComponentRef<typeof OrbitControls>

export function Controls({ resetSignal }: { resetSignal: number }) {
  const ref = useRef<OrbitHandle>(null)
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const fitRef = useRef<() => void>(() => {})
  const fitted = useRef(false)

  // 按画布宽高比拉开镜头，窄屏也能看到整棵树；只在首次拿到画布尺寸和点「回正」时重新取景。
  useEffect(() => {
    fitRef.current = () => {
      if (width <= 0 || height <= 0) return
      const distance = Math.max(19, 18 / (width / height))
      const pitch = 0.2
      camera.position.set(
        0,
        TREE_TARGET[1] + Math.sin(pitch) * distance,
        Math.cos(pitch) * distance,
      )
      ref.current?.target.set(...TREE_TARGET)
      ref.current?.update()
      ref.current?.saveState()
      fitted.current = true
    }
    if (!fitted.current) fitRef.current()
  }, [camera, width, height])

  useEffect(() => {
    if (resetSignal > 0) fitRef.current()
  }, [resetSignal])

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={9}
      maxDistance={36}
      minPolarAngle={0.35}
      maxPolarAngle={1.62}
      target={TREE_TARGET}
    />
  )
}

export interface TimeTreeSceneProps {
  showHistory: boolean
  showBubbles: boolean
  resetSignal: number
}

export default function TimeTreeScene({
  showHistory,
  showBubbles,
  resetSignal,
}: TimeTreeSceneProps) {
  const reduced = usePrefersReducedMotion()
  const days = useMemo(() => buildSevenDays(new Date()), [])
  const history = useMemo(() => buildHistory(new Date()), [])

  return (
    <Canvas camera={{ position: [0, 6, 15], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={['#fffaf0']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 8]} intensity={1.2} />
      <Ground />
      <Trunk />
      <Crown />
      {days.map((day, i) => (
        <Branch
          key={day.offset}
          data={day}
          alpha={((FIRST_ALPHA + (i * 360) / 7) * Math.PI) / 180}
          height={BRANCH_HEIGHTS[i]}
          length={BRANCH_LENGTH}
          rise={0.22}
        />
      ))}
      {showHistory
        ? history.map((day, i) => (
            <Branch
              key={day.offset}
              history
              data={day}
              alpha={((FIRST_ALPHA + ((i * 2 + 0.5) * 360) / 7 + 12) * Math.PI) / 180}
              height={HISTORY_HEIGHTS[i]}
              length={2.1}
              rise={-0.1}
            />
          ))
        : null}
      <Stones />
      {showBubbles ? BUBBLES.map((_, i) => <Bubble key={i} index={i} animate={!reduced} />) : null}
      <Controls resetSignal={resetSignal} />
    </Canvas>
  )
}
