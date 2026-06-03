'use client'

import { useState, useMemo } from 'react'

interface SpellTilesProps {
  word: string
  onSubmit: (val: string) => void
  answered: boolean
  isCorrect: boolean | null
}

export default function SpellTiles({ word, onSubmit, answered, isCorrect }: SpellTilesProps) {
  const segments = useMemo(() => word.split(''), [word])

  // Map each slot index to its segment
  const segmentSlots = useMemo(() => {
    const result: { start: number; end: number }[] = []
    let offset = 0
    for (const seg of segments) {
      result.push({ start: offset, end: offset + seg.length - 1 })
      offset += seg.length
    }
    return result
  }, [segments])

  // Shuffled pool of unique letters, stable for the lifetime of this component instance
  const [pool] = useState<string[]>(() => {
    const letters = word.replace(/ /g, '').split('')
    const uniqueLetters = [...new Set(letters)].sort()
    const wordLetterSet = new Set(uniqueLetters)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'

    // Consecutive forward pairs in the word (e.g. "hunt" → {hu, un, nt})
    const consecutivePairs = new Set<string>()
    for (let i = 0; i < letters.length - 1; i++) {
      consecutivePairs.add(letters[i] + letters[i + 1])
    }

    const chosen = new Set<string>()

    // For each bad adjacent pair in sorted word letters, pick a distractor
    // that falls alphabetically between them — it will naturally slot in when sorted
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

    // Fill remaining distractor slots (for difficulty) with random non-word letters
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

    // Try alphabetical order first
    const sorted = [...uniqueLetters, ...chosen].sort()
    if (!hasDangerousPair(sorted)) return sorted

    // Alphabetical still has dangerous pairs (insufficient distractors) — shuffle until clean
    const arr = [...sorted]
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      if (!hasDangerousPair(arr)) return arr
    }
    return arr
  })

  // placed[slotIdx] = letter string, or null
  const [placed, setPlaced] = useState<(string | null)[]>(() => Array(word.length).fill(null))

  const allFilled = placed.length === word.length && placed.every((p) => p !== null)

  // Responsive sizing based on word length
  const tileSizeSmall =
    'w-12 h-12 text-[1.1rem] sm:w-14 sm:h-14 sm:text-[1.25rem] md:w-16 md:h-16 md:text-[1.4rem]'
  // Pool tile: large, juicy candy-button — sized for 7-year-old fingers
  const poolTileBase =
    'relative touch-manipulation select-none font-nunito font-black ' +
    'w-[clamp(3.75rem,17vw,5.5rem)] h-[clamp(3.5rem,15vw,4.5rem)] ' +
    'sm:w-[clamp(4.5rem,14vw,6.5rem)] sm:h-[clamp(4rem,12vw,5rem)] ' +
    'text-[clamp(1.55rem,5.5vw,2rem)] rounded-2xl border-2 ' +
    '[-webkit-tap-highlight-color:transparent] [transform:translateZ(0)] ' +
    'transition-[transform,box-shadow,filter] duration-[90ms] ease-out ' +
    'will-change-transform'
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
    if (answered) return
    setPlaced((prev) => {
      const next = [...prev]
      next[slotIdx] = null
      return next
    })
  }

  const handleConfirm = () => {
    onSubmit(placed.join(''))
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Answer slots grouped by word segment */}
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {segments.map((seg, si) => (
          <div key={si} className={`flex flex-wrap items-center justify-center ${tileGap}`}>
            {Array.from({ length: seg.length }).map((_, ci) => {
              const slotIdx = segmentSlots[si].start + ci
              const letter = placed[slotIdx]

              let cls = 'border-white/[.25] bg-white/[.04]'
              if (answered) {
                cls = isCorrect
                  ? 'border-[#4ade80] bg-[rgba(74,222,128,.08)]'
                  : 'border-[#f87171] bg-[rgba(248,113,113,.08)]'
              } else if (letter) {
                cls =
                  'border-[#a78bfa] bg-[rgba(167,139,250,.1)] cursor-pointer hover:border-[#f87171]'
              }

              return (
                <div
                  key={ci}
                  onClick={() => {
                    if (letter && !answered) handlePlacedTap(slotIdx)
                  }}
                  className={`${tileSizeSmall} font-nunito flex items-center justify-center rounded-lg border-2 font-black text-[#f0f0ff] touch-manipulation select-none transition-[transform,background,border-color] duration-150 ease-out [-webkit-tap-highlight-color:transparent] ${letter && !answered ? 'cursor-pointer active:scale-90 animate-pop-in' : ''} ${cls}`}
                >
                  {letter ?? <span className={`text-white/20 ${placeholderSize}`}>_</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Pool tiles — chunky 3D candy buttons with instant press feedback */}
      {!answered && (
        <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {pool.map((letter, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handlePoolTap(letter)}
              style={{ animationDelay: `${i * 35}ms` }}
              className={`${poolTileBase} animate-pop-in cursor-pointer border-[#7c3aed]/70 bg-gradient-to-b from-[#c4b5fd] via-[#a78bfa] to-[#7c3aed] text-white shadow-[0_5px_0_#5b21b6,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.18),0_8px_18px_-6px_rgba(124,58,237,.6)] [text-shadow:0_2px_0_rgba(76,29,149,.6)] active:translate-y-[5px] active:shadow-[0_0_0_#5b21b6,inset_0_2px_4px_rgba(0,0,0,.25)] active:brightness-95 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:brightness-110`}
            >
              {letter}
            </button>
          ))}
          <button
            key={'null'}
            type="button"
            onClick={() => handlePoolTap(' ')}
            aria-label="空格"
            style={{ animationDelay: `${pool.length * 35}ms` }}
            className={`${poolTileBase} animate-pop-in cursor-pointer border-[#0e7490]/70 bg-gradient-to-b from-[#a5f3fc] via-[#67e8f9] to-[#06b6d4] text-cyan-900 shadow-[0_5px_0_#155e75,inset_0_2px_0_rgba(255,255,255,.6),inset_0_-2px_0_rgba(0,0,0,.12),0_8px_18px_-6px_rgba(6,182,212,.6)] active:translate-y-[5px] active:shadow-[0_0_0_#155e75,inset_0_2px_4px_rgba(0,0,0,.25)] active:brightness-95 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:brightness-110`}
          >
            <span className="text-[clamp(1.1rem,3.5vw,1.4rem)] tracking-[.4em] [text-shadow:0_2px_0_rgba(8,51,68,.3)]">
              ␣
            </span>
          </button>
        </div>
      )}

      {/* Confirm button — chunky candy button to match pool tiles */}
      {allFilled && !answered && (
        <button
          type="button"
          onClick={handleConfirm}
          className="font-nunito relative mt-1 cursor-pointer touch-manipulation rounded-2xl border-2 border-emerald-700/60 bg-gradient-to-b from-[#86efac] via-[#4ade80] to-[#16a34a] py-3 text-[clamp(.95rem,3vw,1.1rem)] font-black tracking-wide text-white shadow-[0_5px_0_#15803d,inset_0_2px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(0,0,0,.12),0_10px_22px_-6px_rgba(34,197,94,.6)] [-webkit-tap-highlight-color:transparent] [text-shadow:0_2px_0_rgba(20,83,45,.5)] animate-pop-in transition-[transform,box-shadow,filter] duration-100 ease-out active:translate-y-[5px] active:shadow-[0_0_0_#15803d,inset_0_2px_4px_rgba(0,0,0,.25)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:brightness-110"
        >
          ✓ 确认答案
        </button>
      )}

      {/* Feedback */}
      {answered && isCorrect !== null && (
        <div
          className={`rounded-[10px] p-2.5 text-center text-[.86rem] font-bold ${
            isCorrect
              ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
              : 'bg-[rgba(248,113,113,.12)] text-[#f87171]'
          }`}
        >
          {isCorrect ? (
            '✓ 正确！🎉'
          ) : (
            <span>
              ✗ 错误，正确答案：<strong>{word}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
