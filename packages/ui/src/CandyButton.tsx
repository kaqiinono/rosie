'use client'
/* eslint-disable react-hooks/rules-of-hooks */
/**
 * CandyButton — 糖果风格按钮组件
 *
 * 使用方式：
 *   import CandyButton, { CandyButtonGroup, CANDY_PRESETS } from './CandyButton'
 *
 *   // 使用预设
 *   <CandyButton preset="strawberry" label="草莓" onClick={() => {}} />
 *
 *   // 使用预设组
 *   <CandyButtonGroup />
 *
 *   // 自定义配置
 *   <CandyButton
 *     config={{ id: 'custom', ...yourConfig }}
 *     label="自定义"
 *     onClick={() => {}}
 *   />
 */

import { useRef, useEffect, useCallback, useState, FC } from 'react'

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface CandyButtonConfig {
  id: string
  /** 主体渐变亮色 */
  light: string
  /** 主体渐变中间色 */
  mid: string
  /** 阴影颜色 */
  dark: string
  /** 主体 SVG path（80×80 viewBox） */
  path: string
  /** clip-path id（用于内部装饰裁剪） */
  clipId?: string
  /** 按钮内显示的 emoji 或文字 */
  emoji?: string
  /** 高光缩放变换，如 'scale(1,0.48)' */
  shineScale?: string
  /** 白色条纹 path 数组 */
  stripes?: string[]
  /** 高光椭圆位置 */
  specX: number
  specY: number
  specRX?: number
  specRY?: number
  /** 小圆点装饰：[cx, cy, r][] */
  dots?: [number, number, number][]
  dotColor?: string
  /** emoji/label 文字位置 */
  tx?: number
  ty?: number
  /** emoji/text fontSize (default 24) */
  textSize?: number
  /** emoji/text fill color (留空则使用 SVG 默认) */
  textColor?: string
  /** emoji/text font weight */
  textWeight?: number | string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  ay: number
  color: string
  shape: 'circle' | 'rect' | 'pill'
  size: number
  rot: number
  rotV: number
  life: number
  decay: number
}

// ─── 预设配置 ──────────────────────────────────────────────────────────────────

export const CANDY_PRESETS: Record<string, CandyButtonConfig> = {
  strawberry: {
    id: 'strawberry',
    light: '#ffaed4',
    mid: '#e05598',
    dark: '#8a1a50',
    path: 'M40,6 A34,34 0 1,1 40,74 A34,34 0 1,1 40,6 Z',
    clipId: 'clip-strawberry',
    emoji: '🍓',
    shineScale: 'scale(1,0.48)',
    stripes: ['M18,16 Q40,9 62,16 L65,23 Q40,16 15,23 Z'],
    specX: 29,
    specY: 18,
    specRX: 9,
    specRY: 4,
    dots: [
      [56, 55, 3.5],
      [60, 41, 2],
      [51, 63, 2.5],
    ],
    tx: 40,
    ty: 44,
  },
  blueberry: {
    id: 'blueberry',
    light: '#9ee8ff',
    mid: '#2eaadd',
    dark: '#0a5a80',
    path: 'M16,8 Q8,8 8,16 L8,64 Q8,72 16,72 L64,72 Q72,72 72,64 L72,16 Q72,8 64,8 Z',
    clipId: 'clip-blueberry',
    emoji: '🫐',
    shineScale: 'scale(1,0.46)',
    stripes: ['M8,20 Q10,12 18,11 L62,11 Q70,12 72,20 L72,29 L8,29 Z'],
    specX: 28,
    specY: 18,
    specRX: 12,
    specRY: 4,
    dots: [
      [60, 58, 3.5],
      [63, 44, 2],
      [55, 65, 3],
    ],
    tx: 40,
    ty: 44,
  },
  love: {
    id: 'love',
    light: '#ff9cc8',
    mid: '#e0407a',
    dark: '#8a0a38',
    path: 'M40,72 C40,72 6,46 6,24 C6,13 15,6 26,6 C33,6 39,11 40,17 C41,11 47,6 54,6 C65,6 74,13 74,24 C74,46 40,72 40,72 Z',
    clipId: 'clip-love',
    emoji: '💕',
    shineScale: 'scale(1,0.43)',
    stripes: ['M16,18 C20,11 30,8 38,10 L39,15 C32,14 22,17 19,24 Z'],
    specX: 27,
    specY: 16,
    specRX: 9,
    specRY: 4.5,
    dots: [
      [58, 38, 3.5],
      [62, 25, 2],
      [52, 50, 2.5],
    ],
    tx: 40,
    ty: 41,
  },
  candy: {
    id: 'candy',
    light: '#d0aaff',
    mid: '#9040e0',
    dark: '#4a0090',
    path: 'M14,40 Q14,14 36,14 L44,14 Q66,14 66,40 Q66,66 44,66 L36,66 Q14,66 14,40 Z',
    clipId: 'clip-candy',
    emoji: '🍬',
    shineScale: 'scale(1,0.43)',
    stripes: [
      'M21,16 Q25,11 33,10 L40,10 L36,19 Q28,19 21,16 Z',
      'M42,12 L49,12 L45,21 L38,21 Z',
      'M51,12 Q58,11 62,16 L57,22 L49,22 Z',
    ],
    specX: 36,
    specY: 21,
    specRX: 12,
    specRY: 4,
    dots: [
      [57, 57, 3],
      [62, 43, 2],
      [54, 63, 2.2],
    ],
    tx: 40,
    ty: 40,
  },
  marshmallow: {
    id: 'marshmallow',
    light: '#b0ffcc',
    mid: '#32c870',
    dark: '#087030',
    // 云朵形状修正版（收拢到 80×80 viewBox 内）
    path: 'M22,58 Q10,58 10,46 Q10,37 18,34 Q16,22 28,17 Q36,13 45,19 Q50,11 61,13 Q72,15 72,28 Q80,29 82,40 Q84,52 72,57 Z',
    clipId: 'clip-marshmallow',
    emoji: '☁️',
    shineScale: 'translate(0,-4) scale(1,0.40)',
    stripes: ['M28,19 Q36,14 45,18 Q50,12 60,14 Q50,24 38,23 Z'],
    specX: 38,
    specY: 22,
    specRX: 11,
    specRY: 4.5,
    dots: [
      [65, 48, 3.5],
      [70, 37, 2],
      [60, 55, 2.5],
    ],
    tx: 48,
    ty: 40,
  },
}

export const DEFAULT_PRESET_ORDER: (keyof typeof CANDY_PRESETS)[] = [
  'strawberry',
  'blueberry',
  'love',
  'candy',
  'marshmallow',
]

export const DEFAULT_LABELS: Record<string, string> = {
  strawberry: '草莓',
  blueberry: '蓝莓',
  love: '喜欢',
  candy: '糖果',
  marshmallow: '棉花糖',
}

// ─── 粒子颜色 ─────────────────────────────────────────────────────────────────

const PARTICLE_COLORS = [
  '#f7679a',
  '#f5a623',
  '#7ed321',
  '#4a90e2',
  '#bd10e0',
  '#ffd93d',
  '#ff6b6b',
  '#6bcb77',
]

// ─── 全局粒子 Canvas（单例，挂在 document.body） ───────────────────────────────

let globalCanvas: HTMLCanvasElement | null = null
let globalCtx: CanvasRenderingContext2D | null = null
const globalParticles: Particle[] = []
let rafId: number | null = null
let lastTs: number | null = null

function ensureGlobalCanvas() {
  if (globalCanvas) return
  globalCanvas = document.createElement('canvas')
  globalCanvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;'
  globalCanvas.width = window.innerWidth
  globalCanvas.height = window.innerHeight
  document.body.appendChild(globalCanvas)
  globalCtx = globalCanvas.getContext('2d')
  window.addEventListener('resize', () => {
    if (!globalCanvas) return
    globalCanvas.width = window.innerWidth
    globalCanvas.height = window.innerHeight
  })
}

function spawnParticles(rect: DOMRect) {
  const { left: rx, top: ry, width: rw, height: rh } = rect
  for (let i = 0; i < 28; i++) {
    const side = Math.floor(Math.random() * 4)
    let sx: number, sy: number, vx: number, vy: number
    if (side === 0) {
      sx = rx + Math.random() * rw
      sy = ry
      vx = (Math.random() - 0.5) * 80
      vy = -(35 + Math.random() * 90)
    } else if (side === 1) {
      sx = rx + Math.random() * rw
      sy = ry + rh
      vx = (Math.random() - 0.5) * 80
      vy = 35 + Math.random() * 90
    } else if (side === 2) {
      sx = rx
      sy = ry + Math.random() * rh
      vx = -(35 + Math.random() * 75)
      vy = (Math.random() - 0.5) * 80
    } else {
      sx = rx + rw
      sy = ry + Math.random() * rh
      vx = 35 + Math.random() * 75
      vy = (Math.random() - 0.5) * 80
    }
    globalParticles.push({
      x: sx,
      y: sy,
      vx,
      vy,
      ay: 95,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      shape: (['circle', 'rect', 'pill'] as const)[Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 4,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 420,
      life: 1,
      decay: 1.1 + Math.random() * 0.65,
    })
  }
}

function particleLoop(ts: number) {
  if (!lastTs) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.05)
  lastTs = ts

  if (!globalCtx || !globalCanvas) return
  globalCtx.clearRect(0, 0, globalCanvas.width, globalCanvas.height)

  for (let i = globalParticles.length - 1; i >= 0; i--) {
    const p = globalParticles[i]
    p.vy += p.ay * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.rotV * dt
    p.life -= p.decay * dt
    if (p.life <= 0) {
      globalParticles.splice(i, 1)
      continue
    }

    globalCtx.save()
    globalCtx.globalAlpha = Math.max(0, p.life)
    globalCtx.translate(p.x, p.y)
    globalCtx.rotate((p.rot * Math.PI) / 180)
    globalCtx.fillStyle = p.color
    const s = p.size
    if (p.shape === 'circle') {
      globalCtx.beginPath()
      globalCtx.arc(0, 0, s / 2, 0, Math.PI * 2)
      globalCtx.fill()
    } else if (p.shape === 'rect') {
      globalCtx.fillRect(-s / 2, -s * 0.4, s, s * 0.8)
    } else {
      globalCtx.beginPath()
      // roundRect 兼容写法
      const rx2 = s * 0.3,
        w = s * 1.4,
        h = s * 0.6,
        x = -s * 0.7,
        y = -s * 0.3
      globalCtx.moveTo(x + rx2, y)
      globalCtx.lineTo(x + w - rx2, y)
      globalCtx.arcTo(x + w, y, x + w, y + h, rx2)
      globalCtx.lineTo(x + w, y + h - rx2)
      globalCtx.arcTo(x + w, y + h, x + w - rx2, y + h, rx2)
      globalCtx.lineTo(x + rx2, y + h)
      globalCtx.arcTo(x, y + h, x, y + h - rx2, rx2)
      globalCtx.lineTo(x, y + rx2)
      globalCtx.arcTo(x, y, x + rx2, y, rx2)
      globalCtx.closePath()
      globalCtx.fill()
    }
    globalCtx.restore()
  }

  if (globalParticles.length > 0) {
    rafId = requestAnimationFrame(particleLoop)
  } else {
    rafId = null
    lastTs = null
  }
}

function triggerBurst(rect: DOMRect) {
  ensureGlobalCanvas()
  spawnParticles(rect)
  if (!rafId) {
    lastTs = null
    rafId = requestAnimationFrame(particleLoop)
  }
}

// ─── SVG 糖果按钮核心 ─────────────────────────────────────────────────────────

interface CandySVGProps {
  cfg: CandyButtonConfig
  size?: number
}

const CandySVG: FC<CandySVGProps> = ({ cfg, size = 80 }) => {
  const ns = 'http://www.w3.org/2000/svg'
  const gmId = `gm-${cfg.id}`
  const gsId = `gs-${cfg.id}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns={ns}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        {cfg.clipId && (
          <clipPath id={cfg.clipId}>
            <path d={cfg.path} />
          </clipPath>
        )}
        <linearGradient id={gmId} x1="0%" y1="0%" x2="25%" y2="100%">
          <stop offset="0%" stopColor={cfg.light} />
          <stop offset="100%" stopColor={cfg.mid} />
        </linearGradient>
        <linearGradient id={gsId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 底部阴影 */}
      <path d={cfg.path} fill={cfg.dark} transform="translate(0,4)" opacity="0.35" />

      {/* 主体 */}
      <path d={cfg.path} fill={`url(#${gmId})`} />

      {/* 条纹装饰 */}
      {cfg.stripes?.map((s, i) => (
        <path
          key={i}
          d={s}
          fill="rgba(255,255,255,0.18)"
          clipPath={cfg.clipId ? `url(#${cfg.clipId})` : undefined}
        />
      ))}

      {/* 高光覆层 */}
      <path
        d={cfg.path}
        fill={`url(#${gsId})`}
        opacity="0.52"
        transform={cfg.shineScale}
        clipPath={cfg.clipId ? `url(#${cfg.clipId})` : undefined}
      />

      {/* 高光椭圆 */}
      <ellipse
        cx={cfg.specX}
        cy={cfg.specY}
        rx={cfg.specRX ?? 10}
        ry={cfg.specRY ?? 5}
        fill="white"
        opacity="0.42"
        clipPath={cfg.clipId ? `url(#${cfg.clipId})` : undefined}
      />

      {/* 点缀小圆 */}
      {cfg.dots?.map(([cx, cy, r], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={cfg.dotColor ?? 'rgba(255,255,255,0.28)'}
          clipPath={cfg.clipId ? `url(#${cfg.clipId})` : undefined}
        />
      ))}

      {/* Emoji */}
      {cfg.emoji && (
        <text
          x={cfg.tx ?? 40}
          y={cfg.ty ?? 44}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={cfg.textSize ?? 24}
          fill={cfg.textColor}
          fontWeight={cfg.textWeight}
          style={{ userSelect: 'none' }}
        >
          {cfg.emoji}
        </text>
      )}
    </svg>
  )
}

// ─── CandyButton 主组件 ───────────────────────────────────────────────────────

export interface CandyButtonProps {
  /** 直接传入完整配置 */
  config?: CandyButtonConfig
  /** 或使用预设名称 */
  preset?: keyof typeof CANDY_PRESETS
  /** 按钮下方标签 */
  label?: string
  /** 是否展示下方标签（默认 true） */
  showLabel?: boolean
  /** 按钮尺寸（px，默认 80） */
  size?: number
  /** 点击回调 */
  onClick?: (id: string) => void
  className?: string
}

const popKeyframes = `
@keyframes candy-pop {
  0%   { transform: scale(1); }
  30%  { transform: scale(0.91, 1.10); }
  60%  { transform: scale(1.08, 0.93); }
  80%  { transform: scale(0.98, 1.02); }
  100% { transform: scale(1); }
}
`

let styleInjected = false
function injectPopStyle() {
  if (styleInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = popKeyframes
  document.head.appendChild(el)
  styleInjected = true
}

const CandyButton: FC<CandyButtonProps> = ({
  config,
  preset,
  label,
  showLabel = true,
  size = 80,
  onClick,
  className = '',
}) => {
  const cfg = config ?? (preset ? CANDY_PRESETS[preset] : null)
  if (!cfg) {
    console.warn('[CandyButton] 必须提供 config 或有效的 preset')
    return null
  }

  useEffect(() => {
    injectPopStyle()
  }, [])

  const btnRef = useRef<HTMLButtonElement>(null)
  const [popping, setPopping] = useState(false)

  const handleBurst = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    triggerBurst(rect)
    setPopping(true)
  }, [])

  const handleClick = useCallback(() => {
    handleBurst()
    onClick?.(cfg.id)
  }, [cfg.id, handleBurst, onClick])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleBurst()
        onClick?.(cfg.id)
      }
    },
    [cfg.id, handleBurst, onClick],
  )

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
      className={className}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={label ?? cfg.emoji ?? cfg.id}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onAnimationEnd={() => setPopping(false)}
        style={{
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          background: 'none',
          padding: 0,
          display: 'block',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          animation: popping ? 'candy-pop 0.26s ease' : undefined,
          transition: 'filter 0.15s',
          borderRadius: 0,
          // hover 效果在 SVG 上处理
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget.firstChild as SVGElement | null)?.style.setProperty(
            'transform',
            'scale(1.08)',
          )
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget.firstChild as SVGElement | null)?.style.setProperty(
            'transform',
            'scale(1)',
          )
        }}
        onFocus={(e) =>
          e.currentTarget.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(255,255,255,0.7))')
        }
        onBlur={(e) => e.currentTarget.style.removeProperty('filter')}
      >
        <CandySVG cfg={cfg} size={size} />
      </button>
      {showLabel && label && (
        <span
          style={{
            fontSize: 11,
            fontFamily: 'sans-serif',
            fontWeight: 500,
            letterSpacing: '0.5px',
            textAlign: 'center',
            color: 'var(--color-text-secondary, #888)',
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

// ─── CandyButtonGroup 组合组件 ────────────────────────────────────────────────

export interface CandyButtonGroupProps {
  /** 要展示的预设列表（默认全部五个） */
  presets?: (keyof typeof CANDY_PRESETS)[]
  /** 标签映射 */
  labels?: Partial<Record<keyof typeof CANDY_PRESETS, string>>
  /** 每个按钮点击时的回调 */
  onButtonClick?: (id: string) => void
  /** 按钮尺寸（默认 80） */
  buttonSize?: number
  /** 列数（默认自动） */
  columns?: number
  gap?: number
  className?: string
}

export const CandyButtonGroup: FC<CandyButtonGroupProps> = ({
  presets = DEFAULT_PRESET_ORDER,
  labels = DEFAULT_LABELS,
  onButtonClick,
  buttonSize = 80,
  columns,
  gap = 20,
  className = '',
}) => {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : `repeat(${presets.length}, 1fr)`,
    gap,
    justifyItems: 'center',
    alignItems: 'end',
  }

  return (
    <div style={gridStyle} className={className}>
      {presets.map((key) => (
        <CandyButton
          key={key}
          preset={key}
          label={labels[key] ?? DEFAULT_LABELS[key]}
          onClick={onButtonClick}
          size={buttonSize}
        />
      ))}
    </div>
  )
}

export default CandyButton
