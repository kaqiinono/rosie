'use client'

import { useState, useMemo } from 'react'

interface SpellTilesProps {
  word: string
  onSubmit: (val: string) => void
  answered: boolean
  isCorrect: boolean | null
}

export default function SpellTiles({ word, onSubmit, answered, isCorrect }: SpellTilesProps) {
  const segments = useMemo(() => word.split(' '), [word])

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

  const totalLetters = useMemo(() => word.replace(/ /g, '').length, [word])

  // Shuffled pool of tiles, stable for the lifetime of this component instance
  const [pool] = useState<{ letter: string; id: number }[]>(() => {
    const letters = word.replace(/ /g, '').split('')
    const arr = letters.map((letter, id) => ({ letter, id }))

    // Generate distractors: proportional count, capped so total <= 10
    const distractorCount =
      letters.length >= 10
        ? 0
        : Math.min(Math.ceil(letters.length * 0.5), 10 - letters.length)

    if (distractorCount > 0) {
      const wordLetterSet = new Set(letters)
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')
      // Shuffle alphabet to get random order
      for (let i = alphabet.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]]
      }
      let added = 0
      for (const ch of alphabet) {
        if (added >= distractorCount) break
        if (!wordLetterSet.has(ch)) {
          arr.push({ letter: ch, id: letters.length + added })
          added++
        }
      }
    }

    // Fisher-Yates shuffle of full pool (real + distractors)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  })

  // placed[slotIdx] = pool tile id, or null
  const [placed, setPlaced] = useState<(number | null)[]>(() => Array(totalLetters).fill(null))

  const placedIdSet = useMemo(
    () => new Set(placed.filter((x): x is number => x !== null)),
    [placed]
  )

  const allFilled = placed.every(p => p !== null)

  const handlePoolTap = (tileId: number) => {
    if (answered || placedIdSet.has(tileId)) return
    const firstEmpty = placed.indexOf(null)
    if (firstEmpty === -1) return
    setPlaced(prev => {
      const next = [...prev]
      next[firstEmpty] = tileId
      return next
    })
  }

  const handlePlacedTap = (slotIdx: number) => {
    if (answered) return
    setPlaced(prev => {
      const next = [...prev]
      next[slotIdx] = null
      return next
    })
  }

  const handleConfirm = () => {
    let answer = ''
    segments.forEach((seg, si) => {
      if (si > 0) answer += ' '
      const { start } = segmentSlots[si]
      for (let i = 0; i < seg.length; i++) {
        const tileId = placed[start + i]
        answer += tileId !== null ? (pool.find(t => t.id === tileId)?.letter ?? '') : ''
      }
    })
    onSubmit(answer)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Answer slots grouped by word segment */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {segments.map((seg, si) => (
          <div key={si} className="flex items-center gap-1.5">
            {Array.from({ length: seg.length }).map((_, ci) => {
              const slotIdx = segmentSlots[si].start + ci
              const tileId = placed[slotIdx]
              const letter = tileId !== null ? pool.find(t => t.id === tileId)?.letter : null

              let cls = 'border-white/[.25] bg-white/[.04]'
              if (answered) {
                cls = isCorrect
                  ? 'border-[#4ade80] bg-[rgba(74,222,128,.08)]'
                  : 'border-[#f87171] bg-[rgba(248,113,113,.08)]'
              } else if (letter) {
                cls = 'border-[#a78bfa] bg-[rgba(167,139,250,.1)] cursor-pointer hover:border-[#f87171]'
              }

              return (
                <div
                  key={ci}
                  onClick={() => { if (letter && !answered) handlePlacedTap(slotIdx) }}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-nunito font-black text-[1.1rem] text-[#f0f0ff] transition-all select-none ${cls}`}
                >
                  {letter ?? <span className="text-white/20 text-[.7rem]">_</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Pool tiles */}
      {!answered && (
        <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
          {pool.map(tile => {
            const isPlaced = placedIdSet.has(tile.id)
            return (
              <button
                key={tile.id}
                onClick={() => handlePoolTap(tile.id)}
                disabled={isPlaced}
                className={`w-10 h-10 rounded-lg border-2 font-nunito font-black text-[1.1rem] transition-all ${
                  isPlaced
                    ? 'opacity-0 pointer-events-none'
                    : 'border-[rgba(167,139,250,.4)] bg-[rgba(167,139,250,.1)] text-[#c4b5fd] cursor-pointer hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.2)] hover:-translate-y-0.5'
                }`}
              >
                {tile.letter}
              </button>
            )
          })}
        </div>
      )}

      {/* Confirm button — shown only when all slots filled */}
      {allFilled && !answered && (
        <button
          onClick={handleConfirm}
          className="p-3 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] border-0 rounded-xl text-white font-nunito font-extrabold text-[.88rem] cursor-pointer hover:-translate-y-px transition-all"
        >
          ✓ 确认
        </button>
      )}

      {/* Feedback */}
      {answered && isCorrect !== null && (
        <div className={`text-center text-[.86rem] font-bold p-2.5 rounded-[10px] ${
          isCorrect ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]' : 'bg-[rgba(248,113,113,.12)] text-[#f87171]'
        }`}>
          {isCorrect ? '✓ 正确！🎉' : <span>✗ 错误，正确答案：<strong>{word}</strong></span>}
        </div>
      )}
    </div>
  )
}
