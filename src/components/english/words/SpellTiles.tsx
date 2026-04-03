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
  const tileSizeLarge =
    'w-24 h-12 text-[1.6rem] sm:w-26 sm:h-14 sm:text-[1.75rem] md:w-26 md:h-16 md:text-[1.8rem]'
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
    onSubmit(segments.join(''))
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
                  className={`${tileSizeSmall} font-nunito flex items-center justify-center rounded-lg border-2 font-black text-[#f0f0ff] transition-all select-none ${cls}`}
                >
                  {letter ?? <span className={`text-white/20 ${placeholderSize}`}>_</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Pool tiles */}
      {!answered && (
        <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-2">
          {pool.map((letter, i) => (
            <button
              key={i}
              onClick={() => handlePoolTap(letter)}
              className={`w-24 ${tileSizeLarge} font-nunito cursor-pointer rounded-lg border-2 border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.1)] font-black text-[#c4b5fd] transition-all hover:-translate-y-0.5 hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.2)]`}
            >
              {letter}
            </button>
          ))}
          <button
            key={'null'}
            onClick={() => handlePoolTap(' ')}
            className={`w-24 ${tileSizeLarge} font-nunito cursor-pointer rounded-lg border-2 border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.1)] font-black text-[#c4b5fd] transition-all hover:-translate-y-0.5 hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.2)]`}
          />
        </div>
      )}

      {/* Confirm button — shown only when all slots filled */}
      {allFilled && !answered && (
        <button
          onClick={handleConfirm}
          className="font-nunito cursor-pointer rounded-xl border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] p-3 text-[.88rem] font-extrabold text-white transition-all hover:-translate-y-px"
        >
          ✓ 确认
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
