'use client'
/**
 * Jelly 系列组件 — 圆角果冻砖视觉语言
 *
 *  - JellyButton：可点击按钮，有 hover / active 立体下沉、入场弹跳。
 *  - JellyTile：纯展示砖（不可点），有 big / inline 两种尺寸 + mystery 未揭模式。
 *  - 共用一套 JELLY_PRESETS 配色，preset 内分别保存
 *      className（按钮态）/ tileBigClassName / tileInlineClassName。
 *
 * 使用方式：
 *   import JellyButton, {
 *     JellyTile,
 *     JELLY_PRESETS,
 *     DEFAULT_JELLY_ORDER,
 *     pickNonAdjacentJellyPresets,
 *   } from '@rosie/ui'
 *
 *   // 按钮
 *   <JellyButton preset="grape" onClick={() => {}}>A</JellyButton>
 *
 *   // 大展示砖（揭开后的字母）
 *   <JellyTile size="big" preset="grape" rotation={-2}>a</JellyTile>
 *
 *   // 未揭神秘砖
 *   <JellyTile size="big" mystery rotation={3}>🍬</JellyTile>
 *
 *   // 例句行内 mini chip
 *   <JellyTile size="inline" preset="strawberry">a</JellyTile>
 */

'use client'

import { FC, ReactNode, CSSProperties } from 'react'

// ─── 预设 ────────────────────────────────────────────────────────────────────

export interface JellyPreset {
  id: string
  /** 按钮态完整 className：渐变 + 边框 + 立体下沉阴影 + 文字色。供 JellyButton 使用。 */
  className: string
  /** 大砖展示态 className：渐变 + 边框 + 浅一档阴影。供 JellyTile size="big" 使用。 */
  tileBigClassName?: string
  /** 行内 mini-chip className：渐变 + 边框（无阴影）。供 JellyTile size="inline" 使用。 */
  tileInlineClassName?: string
}

export const JELLY_PRESETS = {
  grape: {
    id: 'grape',
    className:
      'border-[#7c3aed]/70 bg-gradient-to-b from-[#c4b5fd] via-[#a78bfa] to-[#7c3aed] text-white shadow-[0_5px_0_#5b21b6,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(124,58,237,.55)] [text-shadow:0_2px_0_rgba(76,29,149,.6)]',
    tileBigClassName:
      'from-[#c4b5fd] via-[#a78bfa] to-[#7c3aed] border-[#6d28d9]/60 shadow-[0_4px_0_#5b21b6,inset_0_2px_0_rgba(255,255,255,.4)]',
    tileInlineClassName: 'from-[#c4b5fd] to-[#7c3aed] border-[#6d28d9]/60',
  },
  tangerine: {
    id: 'tangerine',
    className:
      'border-[#ea580c]/70 bg-gradient-to-b from-[#fed7aa] via-[#fb923c] to-[#ea580c] text-white shadow-[0_5px_0_#c2410c,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(234,88,12,.55)] [text-shadow:0_2px_0_rgba(124,45,18,.6)]',
    tileBigClassName:
      'from-[#fed7aa] via-[#fb923c] to-[#ea580c] border-[#c2410c]/60 shadow-[0_4px_0_#9a3412,inset_0_2px_0_rgba(255,255,255,.4)]',
    tileInlineClassName: 'from-[#fed7aa] to-[#ea580c] border-[#c2410c]/60',
  },
  strawberry: {
    id: 'strawberry',
    className:
      'border-[#be185d]/70 bg-gradient-to-b from-[#fbcfe8] via-[#f472b6] to-[#db2777] text-white shadow-[0_5px_0_#9d174d,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(190,24,93,.55)] [text-shadow:0_2px_0_rgba(131,24,67,.6)]',
    tileBigClassName:
      'from-[#fbcfe8] via-[#f472b6] to-[#db2777] border-[#be185d]/60 shadow-[0_4px_0_#9d174d,inset_0_2px_0_rgba(255,255,255,.4)]',
    tileInlineClassName: 'from-[#fbcfe8] to-[#db2777] border-[#be185d]/60',
  },
  blueberry: {
    id: 'blueberry',
    className:
      'border-[#0369a1]/70 bg-gradient-to-b from-[#bae6fd] via-[#38bdf8] to-[#0284c7] text-white shadow-[0_5px_0_#075985,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(3,105,161,.55)] [text-shadow:0_2px_0_rgba(7,89,133,.6)]',
    tileBigClassName:
      'from-[#bae6fd] via-[#38bdf8] to-[#0284c7] border-[#0369a1]/60 shadow-[0_4px_0_#075985,inset_0_2px_0_rgba(255,255,255,.4)]',
    tileInlineClassName: 'from-[#bae6fd] to-[#0284c7] border-[#0369a1]/60',
  },
  mint: {
    id: 'mint',
    className:
      'border-[#059669]/70 bg-gradient-to-b from-[#a7f3d0] via-[#34d399] to-[#059669] text-white shadow-[0_5px_0_#065f46,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(5,150,105,.55)] [text-shadow:0_2px_0_rgba(6,78,59,.6)]',
    tileBigClassName:
      'from-[#a7f3d0] via-[#34d399] to-[#059669] border-[#047857]/60 shadow-[0_4px_0_#065f46,inset_0_2px_0_rgba(255,255,255,.4)]',
    tileInlineClassName: 'from-[#a7f3d0] to-[#059669] border-[#047857]/60',
  },
  cyan: {
    id: 'cyan',
    className:
      'border-[#0e7490]/70 bg-gradient-to-b from-[#a5f3fc] via-[#67e8f9] to-[#06b6d4] text-cyan-900 shadow-[0_5px_0_#155e75,inset_0_2px_0_rgba(255,255,255,.6),inset_0_-2px_0_rgba(0,0,0,.12),0_8px_18px_-6px_rgba(6,182,212,.55)] [text-shadow:0_2px_0_rgba(8,51,68,.3)]',
    // cyan / honey 暂未给 tile 配色（亮底深字与 JellyTile 默认白字结构不兼容），
    // 若要用作砖块需另设 tileBigClassName / tileInlineClassName。
  },
  honey: {
    id: 'honey',
    className:
      'border-amber-700/50 bg-gradient-to-b from-[#fde68a] via-[#f59e0b] to-[#d97706] text-amber-950 shadow-[0_5px_0_#92400e,inset_0_2px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.1),0_10px_22px_-6px_rgba(217,119,6,.45)] [text-shadow:0_1px_0_rgba(120,53,15,.3)]',
  },
} satisfies Record<string, JellyPreset>

export type JellyPresetKey = keyof typeof JELLY_PRESETS

/** 默认参与随机的色块顺序（不含 cyan/honey，它们留作专用色） */
export const DEFAULT_JELLY_ORDER: JellyPresetKey[] = [
  'grape',
  'tangerine',
  'strawberry',
  'blueberry',
  'mint',
]

/** 随机抽取 N 个预设，保证相邻位不重复 */
export function pickNonAdjacentJellyPresets(
  count: number,
  available: JellyPresetKey[] = DEFAULT_JELLY_ORDER,
): JellyPresetKey[] {
  const out: JellyPresetKey[] = []
  for (let i = 0; i < count; i++) {
    const prev = out[i - 1]
    const pool = available.filter((p) => p !== prev)
    out.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return out
}

// ─── 样式常量（导出便于二次定制） ─────────────────────────────────────────────

/** JellyButton 默认字母砖尺寸（响应式） */
export const JELLY_TILE_SIZE_DEFAULT =
  'w-[clamp(3.75rem,17vw,5.5rem)] h-[clamp(3.5rem,15vw,4.5rem)] ' +
  'sm:w-[clamp(4.5rem,14vw,6.5rem)] sm:h-[clamp(4rem,12vw,5rem)] ' +
  'text-[clamp(1.55rem,5.5vw,2rem)]'

/** JellyButton 基础结构 / 交互类（不含尺寸 / 配色） */
export const JELLY_BASE_CLASSES =
  'relative touch-manipulation select-none font-nunito font-black ' +
  'rounded-3xl border-2 ' +
  '[-webkit-tap-highlight-color:transparent] [transform:translateZ(0)] ' +
  'transition-[transform,box-shadow,filter] duration-[90ms] ease-out ' +
  'will-change-transform animate-pop-in cursor-pointer ' +
  'active:translate-y-[5px] active:shadow-[0_0_0_transparent,inset_0_2px_4px_rgba(0,0,0,.25)] active:brightness-95 ' +
  '[@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:brightness-110 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:translate-y-0'

// JellyTile 结构类（不含配色，配色来自 preset.tileBigClassName / tileInlineClassName）
const TILE_BIG_STRUCTURE =
  'font-fredoka animate-pop-in flex h-[clamp(2.5rem,8vw,3.25rem)] w-[clamp(2.5rem,8vw,3.25rem)] items-center justify-center rounded-2xl border-2 bg-gradient-to-b text-[clamp(1.2rem,4vw,1.6rem)] font-black text-white lowercase [text-shadow:0_2px_0_rgba(0,0,0,.25)]'

const TILE_INLINE_STRUCTURE =
  'font-fredoka animate-pop-in inline-flex h-[1.55em] w-[1.2em] items-center justify-center rounded-md border bg-gradient-to-b text-[.85em] leading-none font-black text-white lowercase'

const MYSTERY_BIG_STRUCTURE =
  'font-fredoka animate-bounce-slow flex h-[clamp(2.5rem,8vw,3.25rem)] w-[clamp(2.5rem,8vw,3.25rem)] items-center justify-center rounded-2xl border-[2px] border-dashed border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50 text-[clamp(1.05rem,3.8vw,1.4rem)]'

const MYSTERY_INLINE_STRUCTURE =
  'font-fredoka animate-bounce-slow inline-flex h-[1.55em] w-[1.2em] items-center justify-center rounded-md border border-dashed border-sky-300 bg-white/70 text-[.85em] leading-none'

// ─── JellyButton ─────────────────────────────────────────────────────────────

export interface JellyButtonProps {
  /** 使用预设名 */
  preset?: JellyPresetKey
  /** 或直接传入完整配置 */
  config?: JellyPreset
  children?: ReactNode
  onClick?: () => void
  /** 包裹旋转角度（度数），用于错落感 */
  rotation?: number
  /** 入场动画延迟（毫秒），用于波浪式弹出 */
  animationDelay?: number
  /** 额外类（追加在配色之后，可覆盖） */
  className?: string
  /** 自定义尺寸类，默认是字母砖尺寸 */
  sizeClassName?: string
  ariaLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const JellyButton: FC<JellyButtonProps> = ({
  preset,
  config,
  children,
  onClick,
  rotation,
  animationDelay,
  className = '',
  sizeClassName = JELLY_TILE_SIZE_DEFAULT,
  ariaLabel,
  disabled = false,
  type = 'button',
}) => {
  const cfg = config ?? (preset ? JELLY_PRESETS[preset] : null)
  if (!cfg) {
    console.warn('[JellyButton] 必须提供 config 或有效的 preset')
    return null
  }

  const btn = (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
      className={`${JELLY_BASE_CLASSES} ${sizeClassName} ${cfg.className} ${className}`}
    >
      {children}
    </button>
  )

  if (rotation !== undefined) {
    return <div style={{ transform: `rotate(${rotation}deg)` }}>{btn}</div>
  }
  return btn
}

export default JellyButton

// ─── JellyTile（展示砖 / 非交互） ──────────────────────────────────────────────

export interface JellyTileProps {
  /** 配色 preset（mystery=true 时忽略） */
  preset?: JellyPresetKey
  /** 未揭开的"神秘砖"模式：虚线边 + 柔色底 + 慢弹动画 */
  mystery?: boolean
  /** big = 方形大砖（默认）；inline = 例句中行内 mini chip */
  size?: 'big' | 'inline'
  /** 旋转角度（度数，big 砖才生效） */
  rotation?: number
  /** 动画延迟（毫秒） */
  animationDelay?: number
  /** 额外类（追加在最后，可覆盖） */
  className?: string
  /** 展示内容：通常是单字母或 emoji */
  children?: ReactNode
  /** 无障碍：传给底层元素 */
  ariaHidden?: boolean
}

export const JellyTile: FC<JellyTileProps> = ({
  preset,
  mystery = false,
  size = 'big',
  rotation,
  animationDelay,
  className = '',
  children,
  ariaHidden,
}) => {
  const style: CSSProperties = {}
  if (rotation !== undefined && size === 'big') {
    style.transform = `rotate(${rotation}deg)`
  }
  if (animationDelay !== undefined) {
    style.animationDelay = `${animationDelay}ms`
  }
  const hasStyle = Object.keys(style).length > 0

  if (size === 'inline') {
    if (mystery) {
      return (
        <span
          aria-hidden={ariaHidden}
          style={hasStyle ? style : undefined}
          className={`${MYSTERY_INLINE_STRUCTURE} ${className}`}
        >
          {children}
        </span>
      )
    }
    const cfg: JellyPreset | null = preset ? JELLY_PRESETS[preset] : null
    if (!cfg?.tileInlineClassName) {
      console.warn(`[JellyTile] preset "${String(preset)}" 没有 tileInlineClassName`)
      return null
    }
    return (
      <span
        aria-hidden={ariaHidden}
        style={hasStyle ? style : undefined}
        className={`${TILE_INLINE_STRUCTURE} ${cfg.tileInlineClassName} ${className}`}
      >
        {children}
      </span>
    )
  }

  // size === 'big'
  if (mystery) {
    return (
      <div
        aria-hidden={ariaHidden}
        style={hasStyle ? style : undefined}
        className={`${MYSTERY_BIG_STRUCTURE} ${className}`}
      >
        {children}
      </div>
    )
  }
  const cfg: JellyPreset | null = preset ? JELLY_PRESETS[preset] : null
  if (!cfg?.tileBigClassName) {
    console.warn(`[JellyTile] preset "${String(preset)}" 没有 tileBigClassName`)
    return null
  }
  return (
    <div
      aria-hidden={ariaHidden}
      style={hasStyle ? style : undefined}
      className={`${TILE_BIG_STRUCTURE} ${cfg.tileBigClassName} ${className}`}
    >
      {children}
    </div>
  )
}
