'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { pickMessage, RETRY_SPELL_MESSAGES } from '@/utils/constant'
import CandyButton, {
  CANDY_PRESETS,
  DEFAULT_PRESET_ORDER,
} from '@/components/shared/CandyButton'
import JellyButton, {
  pickNonAdjacentJellyPresets,
  type JellyPresetKey,
} from '@/components/shared/JellyButton'

export type SpellButtonStyle = 'candy' | 'jelly'

interface SpellTilesProps {
  word: string
  onSubmit: (val: string) => void
  answered: boolean
  isCorrect: boolean | null
  /** 字母池按钮样式：'candy' = SVG 水果造型（默认），'jelly' = 圆角果冻砖 */
  buttonStyle?: SpellButtonStyle
  /** 来自 useQuizRunner 的尝试态；默认 'first' */
  attempt?: 'first' | 'retry' | 'done'
  /** retry 飞回动画结束后调用，让上游清掉 isCorrect 以便二次提交 */
  onRetryAcknowledged?: () => void
  /** 半字母露出提示：预填并锁定前 N 个字母（按 word 顺序） */
  revealedHalf?: number
}

type CandyPresetKey = keyof typeof CANDY_PRESETS

// Subtle scattered rotations — gives a "bag of candies" feel
const TILE_ROTATIONS = [-2, 1.5, -1, 2.5, -1.5, 0.5, -2, 1]

function pickNonAdjacentCandyPresets(count: number): CandyPresetKey[] {
  const all = DEFAULT_PRESET_ORDER
  const out: CandyPresetKey[] = []
  for (let i = 0; i < count; i++) {
    const prev = out[i - 1]
    const avail = all.filter((p) => p !== prev)
    out.push(avail[Math.floor(Math.random() * avail.length)])
  }
  return out
}

type PoolState =
  | { style: 'candy'; pool: string[]; tilePresets: CandyPresetKey[] }
  | { style: 'jelly'; pool: string[]; tilePresets: JellyPresetKey[] }

export default function SpellTiles({
  word,
  onSubmit,
  answered,
  isCorrect,
  buttonStyle = 'candy',
  attempt = 'first',
  onRetryAcknowledged,
  revealedHalf,
}: SpellTilesProps) {
  const segments = useMemo(() => word.split(''), [word])

  const segmentSlots = useMemo(() => {
    const result: { start: number; end: number }[] = []
    let offset = 0
    for (const seg of segments) {
      result.push({ start: offset, end: offset + seg.length - 1 })
      offset += seg.length
    }
    return result
  }, [segments])

  const lockedCount = revealedHalf && revealedHalf > 0 ? Math.min(revealedHalf, word.length) : 0

  const [poolState] = useState<PoolState>(() => {
    const letters = word.replace(/ /g, '').split('')
    const uniqueLetters = [...new Set(letters)].sort()
    const wordLetterSet = new Set(uniqueLetters)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'

    const consecutivePairs = new Set<string>()
    for (let i = 0; i < letters.length - 1; i++) {
      consecutivePairs.add(letters[i] + letters[i + 1])
    }

    const chosen = new Set<string>()

    for (let i = 0; i < uniqueLetters.length - 1; i++) {
      const a = uniqueLetters[i],
        b = uniqueLetters[i + 1]
      if (consecutivePairs.has(a + b)) {
        const ai = alphabet.indexOf(a),
          bi = alphabet.indexOf(b)
        for (let j = ai + 1; j < bi; j++) {
          const ch = alphabet[j]
          if (!wordLetterSet.has(ch) && !chosen.has(ch)) {
            chosen.add(ch)
            break
          }
        }
      }
    }

    const target =
      letters.length >= 10
        ? 0
        : Math.min(Math.ceil(letters.length * 0.5), 10 - uniqueLetters.length)

    if (chosen.size < target) {
      const candidates = alphabet.split('').filter((c) => !wordLetterSet.has(c) && !chosen.has(c))
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
      }
      for (const ch of candidates) {
        if (chosen.size >= target) break
        chosen.add(ch)
      }
    }

    const hasDangerousPair = (arr: string[]) => {
      for (let i = 0; i < arr.length - 1; i++) {
        if (consecutivePairs.has(arr[i] + arr[i + 1])) return true
      }
      return false
    }

    const sorted = [...uniqueLetters, ...chosen].sort()
    let pool: string[] = sorted
    if (hasDangerousPair(sorted)) {
      const arr = [...sorted]
      for (let shufflePass = 0; shufflePass < 20; shufflePass++) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
        if (!hasDangerousPair(arr)) {
          pool = arr
          break
        }
      }
    }

    if (buttonStyle === 'jelly') {
      // jelly 模式空格砖单独用 cyan 色，所以这里只给字母分配色
      return {
        style: 'jelly',
        pool,
        tilePresets: pickNonAdjacentJellyPresets(pool.length),
      }
    }
    // candy 模式空格砖也走糖果造型，所以多分一个 preset
    return {
      style: 'candy',
      pool,
      tilePresets: pickNonAdjacentCandyPresets(pool.length + 1),
    }
  })

  const pool = poolState.pool

  const [placed, setPlaced] = useState<(string | null)[]>(() => {
    const arr: (string | null)[] = Array(word.length).fill(null)
    for (let i = 0; i < lockedCount; i++) arr[i] = word[i]
    return arr
  })

  const allFilled = placed.length === word.length && placed.every((p) => p !== null)

  const tileSizeSmall =
    'w-12 h-12 text-[1.1rem] sm:w-14 sm:h-14 sm:text-[1.25rem] md:w-16 md:h-16 md:text-[1.4rem]'

  const tileGap = 'gap-2 sm:gap-2.5'
  const placeholderSize = 'text-[.75rem]'

  const handlePoolTap = (letter: string) => {
    if (answered || allFilled) return
    const firstEmpty = placed.indexOf(null)
    if (firstEmpty === -1) return
    setPlaced((prev) => {
      const next = [...prev]
      next[firstEmpty] = letter
      return next
    })
  }

  const handlePlacedTap = (slotIdx: number) => {
    if (answered || slotIdx < lockedCount) return
    setPlaced((prev) => {
      const next = [...prev]
      next[slotIdx] = null
      return next
    })
  }

  const handleConfirm = () => {
    onSubmit(placed.join(''))
  }

  const [retryFeedback, setRetryFeedback] = useState<{ correct: Set<number>; wrong: Set<number> } | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed

  useEffect(() => {
    if (attempt !== 'retry') {
      setRetryFeedback(null)
      return
    }
    const snapshot = placedRef.current
    const correct = new Set<number>()
    const wrong = new Set<number>()
    for (let i = 0; i < word.length; i++) {
      const ch = snapshot[i]
      if (ch == null) continue
      if (ch.toLowerCase() === word[i].toLowerCase()) correct.add(i)
      else wrong.add(i)
    }
    setRetryFeedback({ correct, wrong })
    const t = setTimeout(() => {
      setPlaced((prev) => {
        const next = [...prev]
        wrong.forEach((i) => { if (i >= lockedCount) next[i] = null })
        return next
      })
      setRetryFeedback(null)
      onRetryAcknowledged?.()
    }, 700)
    return () => clearTimeout(t)
  }, [attempt, word, lockedCount, onRetryAcknowledged])

  const retryHintSpell = useMemo(() => pickMessage(RETRY_SPELL_MESSAGES), [word])

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Answer slots grouped by word segment */}
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {segments.map((seg, si) => (
          <div key={si} className={`flex flex-wrap items-center justify-center ${tileGap}`}>
            {Array.from({ length: seg.length }).map((_, ci) => {
              const slotIdx = segmentSlots[si].start + ci
              const letter = placed[slotIdx]

              const isCorrectSlot = retryFeedback?.correct.has(slotIdx)
              const isWrongSlot = retryFeedback?.wrong.has(slotIdx)
              const isLockedSlot = slotIdx < lockedCount

              let cls = 'border-white/[.25] bg-white/[.04]'
              if (answered && isCorrect) {
                cls = 'border-[#4ade80] bg-[rgba(74,222,128,.08)]'
              } else if (isCorrectSlot) {
                cls = 'border-[#4ade80] bg-[rgba(74,222,128,.18)]'
              } else if (isWrongSlot) {
                cls = 'border-[var(--rescue-flash-warn)] bg-[rgba(251,191,36,.12)] animate-[shakeReturn_.3s_ease]'
              } else if (answered) {
                // 最终答错（被吃）：保持安静中性，怪兽弹层会接管，不显示可点击态
                cls = 'border-white/[.18] bg-white/[.04]'
              } else if (isLockedSlot) {
                cls = 'border-[#a78bfa]/50 bg-[rgba(167,139,250,.08)]'
              } else if (letter) {
                cls = 'border-[#a78bfa] bg-[rgba(167,139,250,.1)] cursor-pointer'
              }

              return (
                <div
                  key={ci}
                  onClick={() => {
                    if (letter && !answered && slotIdx >= lockedCount) handlePlacedTap(slotIdx)
                  }}
                  className={`${tileSizeSmall} font-nunito flex items-center justify-center rounded-lg border-2 font-black text-[#f0f0ff] touch-manipulation select-none transition-[transform,background,border-color] duration-150 ease-out [-webkit-tap-highlight-color:transparent] ${letter && !answered && slotIdx >= lockedCount ? 'cursor-pointer active:scale-90 animate-pop-in' : ''} ${cls}`}
                >
                  {letter ?? <span className={`text-white/20 ${placeholderSize}`}>_</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Pool tiles — render mode depends on buttonStyle */}
      {!answered &&
        (poolState.style === 'candy' ? (
          <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
            {pool.map((letter, i) => {
              const preset = CANDY_PRESETS[poolState.tilePresets[i]]
              return (
                <div
                  key={i}
                  style={{ transform: `rotate(${TILE_ROTATIONS[i % TILE_ROTATIONS.length]}deg)` }}
                  className={`transition-opacity ${allFilled ? 'opacity-60' : ''}`}
                >
                  <CandyButton
                    config={{
                      ...preset,
                      id: `pool-${i}-${letter}`,
                      emoji: letter,
                      textSize: 38,
                      textColor: '#ffffff',
                      textWeight: 900,
                    }}
                    showLabel={false}
                    size={72}
                    onClick={() => handlePoolTap(letter)}
                  />
                </div>
              )
            })}
            <div
              style={{
                transform: `rotate(${TILE_ROTATIONS[pool.length % TILE_ROTATIONS.length]}deg)`,
              }}
              className={`transition-opacity ${allFilled ? 'opacity-60' : ''}`}
            >
              <CandyButton
                config={{
                  ...CANDY_PRESETS[poolState.tilePresets[pool.length]],
                  id: 'pool-space',
                  emoji: '␣',
                  textSize: 30,
                  textColor: '#ffffff',
                  textWeight: 900,
                }}
                showLabel={false}
                size={72}
                onClick={() => handlePoolTap(' ')}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {pool.map((letter, i) => (
              <JellyButton
                key={i}
                preset={poolState.tilePresets[i]}
                onClick={() => handlePoolTap(letter)}
                rotation={TILE_ROTATIONS[i % TILE_ROTATIONS.length]}
                animationDelay={i * 35}
              >
                {letter}
              </JellyButton>
            ))}
            <JellyButton
              preset="cyan"
              onClick={() => handlePoolTap(' ')}
              rotation={TILE_ROTATIONS[pool.length % TILE_ROTATIONS.length]}
              animationDelay={pool.length * 35}
              ariaLabel="空格"
            >
              <span className="text-[clamp(1.1rem,3.5vw,1.4rem)] tracking-[.4em] [text-shadow:0_2px_0_rgba(8,51,68,.3)]">
                ␣
              </span>
            </JellyButton>
          </div>
        ))}

      {/* Confirm button — warm honey amber, encouraging not alarming */}
      {allFilled && !answered && (
        <button
          type="button"
          onClick={handleConfirm}
          className="font-nunito relative mt-1 cursor-pointer touch-manipulation rounded-2xl border-2 border-amber-700/50 bg-gradient-to-b from-[#fde68a] via-[#f59e0b] to-[#d97706] py-3 text-[clamp(.95rem,3vw,1.1rem)] font-black tracking-wide text-amber-950 shadow-[0_5px_0_#92400e,inset_0_2px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.1),0_10px_22px_-6px_rgba(217,119,6,.45)] [-webkit-tap-highlight-color:transparent] [text-shadow:0_1px_0_rgba(120,53,15,.3)] animate-pop-in transition-[transform,box-shadow,filter] duration-100 ease-out active:translate-y-[5px] active:shadow-[0_0_0_#92400e,inset_0_2px_4px_rgba(0,0,0,.2)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:brightness-105"
        >
          ✓ 确认答案
        </button>
      )}

      {/* Feedback */}
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
          {retryHintSpell}
        </div>
      )}
    </div>
  )
}
