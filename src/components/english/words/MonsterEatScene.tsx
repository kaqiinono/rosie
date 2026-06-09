'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry } from '@/utils/type'
import { MONSTERS } from './monsters'
import { EATEN_TITLE_MESSAGES, EATEN_SUB_MESSAGES, pickMessage } from '@/utils/constant'

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

const CANVAS_SIZE = 280 // outer animation div, px
const MONSTER_SIZE = 220 // rendered SVG size, px
const SVG_VIEWBOX = 200 // SVG viewBox dimension

// Random candy silhouettes for the flying word chip — all text-friendly border-radii
const CANDY_SHAPES = ['9999px', '20px', '46% 54% 50% 50% / 58% 42% 58% 42%', '50% / 62%'] as const

interface Props {
  /**
   * Word entry to display in the eat animation + belly card.
   * Must originate from controlled vocab data (WordEntry); never arbitrary user input.
   * `word` is HTML-escaped before insertion via dangerouslySetInnerHTML.
   * null = scene hidden.
   */
  entry: WordEntry | null
  monsterIdx: number
  /** 同 session 内第二次起，缩短动画到 1.2s */
  isAbbreviated: boolean
  onDismiss: () => void
}

type Phase = 'enter' | 'flying' | 'eaten' | 'done'

export default function MonsterEatScene({ entry, monsterIdx, isAbbreviated, onDismiss }: Props) {
  const monster = MONSTERS[monsterIdx] ?? MONSTERS[0]
  const [phase, setPhase] = useState<Phase>('enter')
  const word = entry?.word ?? null

  // Pick a raw title template index (not substituted) so we can do rich HTML wrapping later
  const tplIdx = useMemo(
    () => Math.floor(Math.random() * EATEN_TITLE_MESSAGES.length),
    // Intentionally keyed only on `word` — re-randomize template selection per new word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word],
  )
  const titleTpl = EATEN_TITLE_MESSAGES[tplIdx]

  // Sub message can use pickMessage since it only needs plain text
  const sub = useMemo(
    () => pickMessage(EATEN_SUB_MESSAGES, { name: monster.name }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word, monster.name],
  )

  // Random candy silhouette per word (stable across re-renders within a word)
  const candyShape = useMemo(
    () => CANDY_SHAPES[Math.floor(Math.random() * CANDY_SHAPES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word],
  )

  // Detect reduced-motion preference once on mount
  const reducedMotionRef = useRef(false)
  // Snapshot at mount; does not react to mid-session OS reduced-motion changes.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  useEffect(() => {
    if (!word) return
    const reduced = reducedMotionRef.current
    // tone controls timing:
    //   short  = reduced-motion: compress to ~0.6s, skip fly visual
    //   mid    = abbreviated (2nd+ wrong answer same session): 1.2s
    //   full   = first wrong answer: 2.1s
    const tone: 'short' | 'mid' | 'full' = reduced ? 'short' : isAbbreviated ? 'mid' : 'full'

    setPhase('enter')

    const tEnter = tone === 'short' ? 100 : tone === 'mid' ? 250 : 450
    const tFly = tone === 'short' ? 400 : tone === 'mid' ? 850 : 1500
    const tDone = tone === 'short' ? 600 : tone === 'mid' ? 1200 : 2100

    const t1 = setTimeout(() => setPhase('flying'), tEnter)
    const t2 = setTimeout(() => setPhase('eaten'), tFly)
    const t3 = setTimeout(() => setPhase('done'), tDone)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [word, isAbbreviated])

  // Toggle mouth-open / mouth-closed via string-level attribute replacement.
  // This avoids DOM mutation after mount and keeps the SVG as a pure derived value.
  const monsterHtml = useMemo(() => {
    const showOpen = phase === 'flying' || phase === 'eaten'
    return monster.body
      .replace(
        /<g id="mouth-closed"[^>]*>/,
        `<g id="mouth-closed"${showOpen ? ' display="none"' : ''}>`,
      )
      .replace(
        /<g id="mouth-open"[^>]*>/,
        `<g id="mouth-open"${showOpen ? '' : ' display="none"'}>`,
      )
  }, [monster.body, phase])

  if (!entry || !word) return null

  const ipaStr = entry.ipa ? entry.ipa.replace(/^\/|\/$/g, '') : null
  const titleHtml = titleTpl
    .replace(/{word}/g, `<b style="color:#D85A30">${escapeHtml(word)}</b>`)
    .replace(/{name}/g, `<b>${escapeHtml(monster.name)}</b>`)

  // Candy chip colours derived from the monster's own colour (color-mix → light top, dark edge)
  const candyLight = `color-mix(in srgb, ${monster.color} 42%, white)`
  const candyDark = `color-mix(in srgb, ${monster.color} 62%, black)`
  const candyEdge = `color-mix(in srgb, ${monster.color} 50%, black)`

  // Flying-word target position: mouth center in canvas-pixel coords.
  // monster-body is 220×220, centered inside a 280×280 canvas.
  // SVG viewBox is 200×200, so scale = 220/200 = 1.1
  const svgScale = MONSTER_SIZE / SVG_VIEWBOX
  const monsterOff = (CANVAS_SIZE - MONSTER_SIZE) / 2 // 30px offset on each side
  const targetLeft = monsterOff + monster.mouth.x * svgScale
  const targetTop = monsterOff + monster.mouth.y * svgScale

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-3 backdrop-blur-md"
      style={{ background: 'var(--rescue-monster-veil)' }}
    >
      <div className="font-nunito flex max-h-[92vh] w-full max-w-[340px] flex-col items-center overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
        {/* ── Swallow animation (enter / flying / eaten) ─────────────────── */}
        {phase !== 'done' && (
          <div className="relative mx-auto flex h-[280px] w-[280px] max-w-full items-center justify-center">
            {/* Flying word chip — candy style (CandyButton aesthetic), enter/flying only */}
            {(phase === 'enter' || phase === 'flying') && (
              <div
                className="absolute top-0 left-0 z-10 px-5 py-2.5 text-[22px] font-extrabold whitespace-nowrap text-white"
                style={{
                  borderRadius: candyShape,
                  background: `linear-gradient(165deg, ${candyLight} 0%, ${monster.color} 56%, ${candyDark} 100%)`,
                  boxShadow: `0 5px 0 ${candyEdge}, 0 12px 20px color-mix(in srgb, ${monster.color} 45%, transparent), inset 0 2px 5px rgba(255,255,255,.55)`,
                  textShadow: '0 1px 3px rgba(0,0,0,.4)',
                  transform:
                    phase === 'enter'
                      ? `translate(${CANVAS_SIZE / 2}px, 10px) translateX(-50%) scale(1)`
                      : `translate(${targetLeft}px, ${targetTop - 18}px) translateX(-50%) scale(0.15) rotate(8deg)`,
                  opacity: phase === 'flying' ? 0 : 1,
                  transition:
                    phase === 'flying'
                      ? 'transform .55s cubic-bezier(.55,0,.6,1), opacity .45s ease .15s'
                      : 'none',
                  willChange: phase === 'enter' ? 'transform' : undefined,
                }}
              >
                {/* glossy candy shine on top */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1.5 top-1 rounded-full"
                  style={{
                    height: '33%',
                    background: 'linear-gradient(to bottom, rgba(255,255,255,.7), rgba(255,255,255,0))',
                  }}
                />
                <span className="relative">{word}</span>
              </div>
            )}

            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute h-[220px] w-[220px]"
              style={{
                // left/top centering is set inline (not Tailwind left-1/2/top-1/2)
                // because those fraction utilities do not apply reliably here.
                left: '50%',
                top: '50%',
                transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
                transform:
                  phase === 'enter'
                    ? 'translate(-50%,-50%) scale(.7)'
                    : 'translate(-50%,-50%) scale(1)',
              }}
              dangerouslySetInnerHTML={{ __html: monsterHtml }}
            />
          </div>
        )}

        {/* ── Eaten result: monster split around the word card ──────────────
            head (top) → body-colour card frame replacing the mouth (middle) →
            lower body + feet (bottom). Both monster pieces are the real SVG,
            cropped/tucked so the card looks swallowed into the belly. */}
        {phase === 'done' && (
          <div className="flex w-full animate-[fade-up_.3s_ease] flex-col items-center">
            {/* HEAD — full monster, lower half tucked behind the card frame */}
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
              className="relative z-10 -mb-[58px] h-[160px] w-[160px]"
              dangerouslySetInnerHTML={{ __html: monsterHtml }}
            />

            {/* BELLY CARD — body-colour frame wrapping the word card (replaces mouth) */}
            <div
              className="relative z-20 w-full max-w-[300px] animate-[belly-pop_.42s_cubic-bezier(.34,1.56,.64,1)] rounded-[32px] p-3 shadow-[0_12px_30px_rgba(0,0,0,.18)]"
              style={{ backgroundColor: monster.color }}
            >
              <div className="rounded-3xl bg-white px-4 py-4 text-center shadow-[inset_0_2px_8px_rgba(0,0,0,.05)]">
                <div className="font-fredoka text-[30px] leading-tight font-extrabold text-[#2b2660]">
                  {word}
                </div>
                {ipaStr && (
                  <div className="mt-1 font-mono text-[13px] font-semibold text-[#7c6df0]">
                    /{ipaStr}/
                  </div>
                )}
                {(entry.chineseDef || entry.explanation) && (
                  <div className="mt-3 rounded-2xl bg-[rgba(127,119,221,.08)] px-3 py-2.5 text-[13.5px] leading-relaxed">
                    {entry.chineseDef && (
                      <div className="font-bold text-[#4a4470]">{entry.chineseDef}</div>
                    )}
                    {entry.explanation && (
                      <div className="mt-1 text-[#6b6790]">{entry.explanation}</div>
                    )}
                  </div>
                )}
                {entry.example && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-2xl bg-[rgba(93,202,165,.12)] px-3 py-2 text-left text-[12.5px] leading-snug text-[#3f7d63]">
                    <span aria-hidden>💬</span>
                    <span className="italic">{entry.example}</span>
                  </div>
                )}
              </div>
            </div>

            {/* LOWER BODY + FEET — body-colour bump + two feet peeking below the card.
                Drawn (not SVG-clipped) so every monster shows feet, incl. the footless ghost. */}
            <div className="relative z-0 -mt-[20px] flex flex-col items-center">
              <div
                style={{
                  width: 108,
                  height: 32,
                  backgroundColor: monster.color,
                  borderBottomLeftRadius: 54,
                  borderBottomRightRadius: 54,
                }}
              />
              <div className="-mt-2 flex gap-5">
                <span
                  style={{
                    width: 42,
                    height: 18,
                    backgroundColor: monster.color,
                    filter: 'brightness(.85)',
                    borderRadius: '50%',
                  }}
                />
                <span
                  style={{
                    width: 42,
                    height: 18,
                    backgroundColor: monster.color,
                    filter: 'brightness(.85)',
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>

            {/* gentle message */}
            <div className="mt-3.5 px-1 text-center text-sm leading-relaxed font-bold text-[#3C3489]">
              <div dangerouslySetInnerHTML={{ __html: titleHtml }} />
              <div className="mt-1 font-bold text-[#854F0B]">{sub}</div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="mt-3 w-full rounded-xl bg-[#534AB7] px-8 py-2.5 text-[15px] font-extrabold text-white transition hover:bg-[#3C3489]"
            >
              ⚔️ 知道啦，继续闯关！
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
