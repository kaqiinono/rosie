'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { pickMessage, RETRY_SPELL_MESSAGES } from '@/utils/constant'
import CandyButton, {
  CANDY_PRESETS,
  DEFAULT_PRESET_ORDER,
} from '@/components/shared/CandyButton'
import {
  JELLY_BASE_CLASSES,
  JELLY_PRESETS,
  DEFAULT_JELLY_ORDER,
} from '@/components/shared/JellyButton'
import type { SpellButtonStyle } from './SpellTiles'

interface FullSpellInputProps {
  word: string
  onSubmit: (val: string) => void
  answered: boolean
  isCorrect: boolean | null
  /** 字母键盘按钮样式：'candy' = SVG 水果造型（默认），'jelly' = 圆角果冻砖 */
  buttonStyle?: SpellButtonStyle
  /** 来自 useQuizRunner 的尝试态；默认 'first' */
  attempt?: 'first' | 'retry' | 'done'
  /** retry 时清空输入后回调，让上游清掉 isCorrect 以便二次提交 */
  onRetryAcknowledged?: () => void
  /** 主轮"考完再判分"模式：提交只记录答案并前进，不显示判分/反馈。 */
  deferred?: boolean
}

// QWERTY 标准 26 键布局
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

type CandyPresetKey = keyof typeof CANDY_PRESETS

export default function FullSpellInput({
  word,
  onSubmit,
  answered,
  isCorrect,
  buttonStyle = 'candy',
  attempt = 'first',
  onRetryAcknowledged,
  deferred = false,
}: FullSpellInputProps) {
  const [typed, setTyped] = useState('')

  // retry 进入时清空输入，并通知上游重置 isCorrect，让第二次拼写可重新判定。
  const [prevAttempt, setPrevAttempt] = useState(attempt)
  if (prevAttempt !== attempt) {
    setPrevAttempt(attempt)
    if (attempt === 'retry') {
      setTyped('')
      onRetryAcknowledged?.()
    }
  }

  // 字母键盘自适应尺寸：按键盘容器的真实宽度铺满最长一行（10 键），
  // 让按键尽量大且不换行。键盘整体全宽（escape 卡片内边距）。
  const kbRef = useRef<HTMLDivElement>(null)
  const KEY_GAP = 4
  const [keySize, setKeySize] = useState(46)
  useEffect(() => {
    const el = kbRef.current
    if (!el) return
    const measure = () => {
      const W = el.clientWidth - 8 // 减去左右内边距 (px-1)
      // floor((W-9*gap)/10) 保证 10 键一行恰好放下、绝不溢出换行；
      // 上限 66 让宽屏按键足够大，下限 26 兜底极窄屏。
      const size = Math.floor((W - 9 * KEY_GAP) / 10)
      setKeySize(Math.max(26, Math.min(66, size)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const retryHint = useMemo(() => pickMessage(RETRY_SPELL_MESSAGES), [word, attempt])

  const append = (ch: string) => {
    if (answered) return
    setTyped((t) => t + ch)
  }
  const backspace = () => {
    if (answered) return
    setTyped((t) => t.slice(0, -1))
  }
  const confirm = () => {
    if (answered || typed.length === 0) return
    onSubmit(typed)
  }

  // 输入展示：每个已输入字符一个格子，末尾再加一个下划线"光标"格子 —
  // 永远不暴露单词长度（只显示「已输入 + 1 个待输入位」）。
  const cells: { ch: string | null; cursor: boolean }[] = [
    ...typed.split('').map((ch) => ({ ch, cursor: false })),
    ...(answered ? [] : [{ ch: null, cursor: true }]),
  ]

  const cellBase =
    'flex h-12 min-w-12 items-center justify-center rounded-lg border-2 px-1.5 text-[1.4rem] font-black text-[#f0f0ff] font-nunito select-none sm:h-14 sm:min-w-14 sm:text-[1.6rem]'
  let cellTone = 'border-white/[.25] bg-white/[.04]'
  if (answered && isCorrect) cellTone = 'border-[#4ade80] bg-[rgba(74,222,128,.1)] text-[#4ade80]'
  else if (answered) cellTone = 'border-white/[.18] bg-white/[.04]'

  // 单个字母键（candy / jelly 共用同一套测量尺寸，保证一致铺满）
  const renderLetterKey = (ch: string, idx: number) => {
    if (buttonStyle === 'jelly') {
      const preset = DEFAULT_JELLY_ORDER[idx % DEFAULT_JELLY_ORDER.length]
      return (
        <button
          key={ch}
          type="button"
          aria-label={ch}
          onClick={() => append(ch)}
          style={{ width: keySize, height: keySize, fontSize: Math.round(keySize * 0.48) }}
          className={`${JELLY_BASE_CLASSES} flex items-center justify-center !rounded-2xl ${JELLY_PRESETS[preset].className}`}
        >
          {ch}
        </button>
      )
    }
    const presetKey: CandyPresetKey = DEFAULT_PRESET_ORDER[idx % DEFAULT_PRESET_ORDER.length]
    return (
      <CandyButton
        key={ch}
        config={{
          ...CANDY_PRESETS[presetKey],
          id: `kbd-${ch}`,
          emoji: ch,
          textSize: Math.round(keySize * 0.52),
          textColor: '#ffffff',
          textWeight: 900,
        }}
        showLabel={false}
        size={keySize}
        onClick={() => append(ch)}
      />
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* 输入展示区（下划线光标，不暴露长度） */}
      <div className="flex min-h-12 w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {cells.map((c, i) =>
          c.cursor ? (
            <div
              key={`cursor-${i}`}
              className="flex h-12 w-8 items-end justify-center pb-1 text-[1.8rem] leading-none font-black text-[#a78bfa] sm:h-14"
            >
              <span className="animate-pulse">_</span>
            </div>
          ) : (
            <div key={i} className={`${cellBase} ${cellTone}`}>
              {c.ch === ' ' ? <span className="text-white/30">␣</span> : c.ch}
            </div>
          ),
        )}
        {cells.length === 0 && (
          <div className="text-[0.95rem] font-bold text-white/30">请用下方键盘拼出单词</div>
        )}
      </div>

      {/* 自制 26 字母键盘（全宽，escape 卡片内边距，按键尽量大） */}
      {!answered && (
        <div
          ref={kbRef}
          className="relative left-1/2 w-screen max-w-[760px] -translate-x-1/2 px-1"
        >
          <div className="flex w-full flex-col items-center gap-2 sm:gap-2.5">
            {KEY_ROWS.map((row, rowIdx) => {
              const offset = rowIdx === 0 ? 0 : rowIdx === 1 ? 10 : 19
              return (
                <div
                  key={rowIdx}
                  className="flex flex-nowrap justify-center"
                  style={{ gap: KEY_GAP }}
                >
                  {row.split('').map((ch, ci) => renderLetterKey(ch, offset + ci))}
                </div>
              )
            })}

            {/* 功能键：空格 / 删除 / 确认 */}
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => append(' ')}
              className="font-nunito cursor-pointer touch-manipulation rounded-xl border-2 border-cyan-400/50 bg-cyan-400/[.12] px-6 py-2.5 text-[.85rem] font-black tracking-[.3em] text-cyan-200 transition active:scale-95 [@media(hover:hover)]:hover:bg-cyan-400/20"
            >
              ␣ 空格
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={typed.length === 0}
              className="font-nunito cursor-pointer touch-manipulation rounded-xl border-2 border-rose-400/50 bg-rose-400/[.12] px-5 py-2.5 text-[.95rem] font-black text-rose-200 transition active:scale-95 disabled:cursor-default disabled:opacity-40 [@media(hover:hover)]:hover:bg-rose-400/20"
            >
              ⌫ 删除
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={typed.length === 0}
              className="font-nunito relative cursor-pointer touch-manipulation rounded-xl border-2 border-amber-700/50 bg-gradient-to-b from-[#fde68a] via-[#f59e0b] to-[#d97706] px-7 py-2.5 text-[.95rem] font-black text-amber-950 shadow-[0_4px_0_#92400e,inset_0_2px_0_rgba(255,255,255,.5)] [text-shadow:0_1px_0_rgba(120,53,15,.3)] transition active:translate-y-[4px] active:shadow-none disabled:cursor-default disabled:opacity-50 disabled:active:translate-y-0 [@media(hover:hover)]:hover:brightness-105"
            >
              {deferred ? '确认并继续 →' : '✓ 确认答案'}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* 反馈 */}
      {attempt === 'done' && isCorrect === true && (
        <div className="rounded-[10px] bg-[rgba(74,222,128,.12)] p-2.5 text-center text-[.86rem] font-bold text-[#4ade80]">
          ✓ 正确！🎉
        </div>
      )}
      {attempt === 'retry' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-[var(--rescue-flash-warn)]/40 bg-[rgba(251,191,36,.08)] px-4 py-3 text-center text-[.88rem] font-bold text-[#fbbf24] animate-[fade-up_.2s_ease]"
        >
          {retryHint}
        </div>
      )}
    </div>
  )
}
