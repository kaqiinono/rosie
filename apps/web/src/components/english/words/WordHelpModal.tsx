'use client'

import type { WordEntry } from '@/utils/type'
import { letterCount } from '@/utils/english-helpers'
import { JellyTile, DEFAULT_JELLY_ORDER } from '@/components/shared/JellyButton'

interface WordHelpModalProps {
  open: boolean
  word: WordEntry
  revealed: number
  onReveal: () => void
  onClose: () => void
}

const TILE_ROT = [-3, 2, -1.5, 2.5, -2, 1.5, -2.5, 1, -1, 3]
// Playful mystery icons rotated per slot so unrevealed letters don't feel dull/blank.
const MYSTERY_GLYPHS = ['🍬', '🌟', '🎈', '🎁', '🍭', '🪄', '🦄', '🧁']

interface Tile {
  ch: string
  isLetter: boolean
  revealedIdx: number // 0-based index among revealed letters; -1 if not yet
}

function tilesOf(word: string, revealed: number): Tile[] {
  const out: Tile[] = []
  let lettersShown = 0
  for (const ch of word) {
    if (/[a-zA-Z]/.test(ch)) {
      const isShown = lettersShown < revealed
      out.push({ ch, isLetter: true, revealedIdx: isShown ? lettersShown : -1 })
      lettersShown++
    } else {
      out.push({ ch, isLetter: false, revealedIdx: -1 })
    }
  }
  return out
}

/** Split an example sentence around the first whole-word occurrence of `word`. */
function splitExampleAroundWord(
  example: string,
  word: string,
): { before: string; match: string | null; after: string } {
  const escaped = word.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('(?<![a-zA-Z])' + escaped + '(?![a-zA-Z])', 'i')
  const m = example.match(re)
  if (!m || m.index === undefined) return { before: example, match: null, after: '' }
  return {
    before: example.slice(0, m.index),
    match: m[0],
    after: example.slice(m.index + m[0].length),
  }
}

export default function WordHelpModal({
  open,
  word,
  revealed,
  onReveal,
  onClose,
}: WordHelpModalProps) {
  if (!open) return null
  const totalLetters = letterCount(word.word)
  const canReveal = revealed < totalLetters
  const example = word.example ?? ''
  const bigTiles = tilesOf(word.word, revealed)
  const split = example ? splitExampleAroundWord(example, word.word) : null
  // Use the matched form's actual casing if the word appears in the example
  // (preserves "Apple" capitalization etc.). Fall back to the canonical word.
  const inlineWordForm = split?.match ?? word.word
  const inlineTiles = tilesOf(inlineWordForm, revealed)

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 px-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="font-nunito animate-pop-in relative w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[28px] lg:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 0% 0%, rgba(125,211,252,.18) 0, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(244,114,182,.14) 0, transparent 55%)',
        }}
      >
        {/* Confetti dots scattered behind everything for a sticker-book feel */}
        <div className="pointer-events-none absolute inset-0 select-none">
          <span className="absolute top-3 left-6 text-[10px] opacity-50">✨</span>
          <span className="absolute top-8 right-14 text-[12px] opacity-40">🌟</span>
          <span className="absolute bottom-16 left-4 text-[14px] opacity-30">🎈</span>
          <span className="absolute right-6 bottom-6 text-[10px] opacity-40">⭐</span>
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-gray-500 shadow-[0_2px_0_rgba(0,0,0,.08)] transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="关闭"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative px-5 pt-5 pb-5">
          {/* Header: sticker-ribbon title — pr-10 reserves room for the absolute close button */}
          <div className="mb-4 flex items-center gap-2 pr-10">
            <div className="font-fredoka inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#38bdf8] to-[#6366f1] px-3 py-1 text-[13px] font-black tracking-wide text-white shadow-[0_3px_0_rgba(0,0,0,.15)]">
              <span className="text-[15px]">🎈</span>
              <span>单词小帮手</span>
            </div>
            <span className="ml-auto rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-amber-700">
              已揭 {revealed} / {totalLetters}
            </span>
          </div>

          {/* Big letter tiles — the main attraction */}
          <div className="mb-4 flex flex-wrap items-end justify-center gap-1.5 sm:gap-2">
            {bigTiles.map((t, i) => {
              if (!t.isLetter) {
                return (
                  <div
                    key={i}
                    aria-hidden
                    className="h-[clamp(2.5rem,8vw,3.25rem)] w-[clamp(.4rem,2vw,.7rem)] shrink-0"
                  />
                )
              }
              const rot = TILE_ROT[i % TILE_ROT.length]
              if (t.revealedIdx < 0) {
                return (
                  <JellyTile
                    key={i}
                    size="big"
                    mystery
                    rotation={rot}
                    animationDelay={i * 120}
                  >
                    {MYSTERY_GLYPHS[i % MYSTERY_GLYPHS.length]}
                  </JellyTile>
                )
              }
              const presetKey = DEFAULT_JELLY_ORDER[t.revealedIdx % DEFAULT_JELLY_ORDER.length]
              return (
                <JellyTile
                  key={i}
                  size="big"
                  preset={presetKey}
                  rotation={rot}
                  animationDelay={t.revealedIdx * 30}
                >
                  {t.ch}
                </JellyTile>
              )
            })}
          </div>

          {/* Example sentence with inline candy mini-tiles instead of plain underscores */}
          {example && split && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 px-4 py-3">
              <div className="mb-1.5 text-[10px] font-extrabold tracking-[.16em] text-sky-700 uppercase">
                📖 例句
              </div>
              <div className="text-[clamp(.95rem,3vw,1.05rem)] leading-[2] font-bold text-sky-950">
                {split.before}
                {split.match !== null ? (
                  <span className="inline-flex items-baseline gap-[2px] align-baseline">
                    {inlineTiles.map((t, i) => {
                      if (!t.isLetter) {
                        return (
                          <span key={i} aria-hidden className="inline-block w-1.5">
                            {t.ch === ' ' ? ' ' : t.ch}
                          </span>
                        )
                      }
                      if (t.revealedIdx < 0) {
                        return (
                          <JellyTile
                            key={i}
                            size="inline"
                            mystery
                            animationDelay={i * 90}
                          >
                            {MYSTERY_GLYPHS[(i + 3) % MYSTERY_GLYPHS.length]}
                          </JellyTile>
                        )
                      }
                      const presetKey =
                        DEFAULT_JELLY_ORDER[t.revealedIdx % DEFAULT_JELLY_ORDER.length]
                      return (
                        <JellyTile
                          key={i}
                          size="inline"
                          preset={presetKey}
                          animationDelay={t.revealedIdx * 30}
                        >
                          {t.ch}
                        </JellyTile>
                      )
                    })}
                  </span>
                ) : null}
                {split.after}
              </div>
            </div>
          )}

          {/* Reveal hint + 学会了 (close), side-by-side. Once all letters are revealed, */}
          {/* the amber hint slot swaps to a celebration banner but 学会了 stays put. */}
          <div className="flex gap-2.5">
            {canReveal ? (
              <button
                type="button"
                onClick={onReveal}
                className="font-fredoka flex-1 cursor-pointer rounded-2xl border border-amber-400 bg-amber-400 py-3 text-[clamp(.95rem,3vw,1.05rem)] font-bold tracking-wide text-white shadow-[0_2px_0_#d97706] transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-amber-500 active:translate-y-[2px] active:shadow-[0_0_0_#d97706]"
              >
                💡 帮帮我
              </button>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 px-3 py-3 text-center text-[clamp(.8rem,2.4vw,.92rem)] leading-tight font-extrabold text-emerald-800">
                🎉 全揭开啦，去默写它！
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="font-fredoka flex-1 cursor-pointer rounded-2xl border border-emerald-500 bg-emerald-500 py-3 text-[clamp(.95rem,3vw,1.05rem)] font-bold tracking-wide text-white shadow-[0_2px_0_#059669] transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-emerald-600 active:translate-y-[2px] active:shadow-[0_0_0_#059669]"
            >
              🎯 知道了
            </button>
          </div>

          {/* Soft warning about reinforcement — friendly, not scary */}
          <div className="font-nunito mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-rose-500/85">
            <span>🌱</span>
            <span>每点一次帮助，练习结束后会多巩固这个词一次</span>
          </div>
        </div>
      </div>
    </div>
  )
}
