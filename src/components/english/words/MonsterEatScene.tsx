'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MONSTERS } from './monsters'
import { EATEN_TITLE_MESSAGES, EATEN_SUB_MESSAGES, pickMessage } from '@/utils/constant'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  )
}

const CANVAS_SIZE = 280        // outer animation div, px
const MONSTER_SIZE = 220       // rendered SVG size, px
const SVG_VIEWBOX = 200        // SVG viewBox dimension

interface Props {
  /**
   * Word to display in the eat animation.
   * Must originate from WordEntry.word (controlled vocab data); never pass arbitrary user input.
   * HTML-escaped before insertion via dangerouslySetInnerHTML.
   */
  word: string | null
  monsterIdx: number
  /** 同 session 内第二次起，缩短动画到 1.2s */
  isAbbreviated: boolean
  onDismiss: () => void
}

type Phase = 'enter' | 'flying' | 'eaten' | 'done'

export default function MonsterEatScene({
  word,
  monsterIdx,
  isAbbreviated,
  onDismiss,
}: Props) {
  const monster = MONSTERS[monsterIdx] ?? MONSTERS[0]
  const [phase, setPhase] = useState<Phase>('enter')

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

  // Detect reduced-motion preference once on mount
  const reducedMotionRef = useRef(false)
  // Snapshot at mount; does not react to mid-session OS reduced-motion changes.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotionRef.current = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    }
  }, [])

  useEffect(() => {
    if (!word) return
    const reduced = reducedMotionRef.current
    // tone controls timing:
    //   short  = reduced-motion: compress to ~0.6s, skip fly visual
    //   mid    = abbreviated (2nd+ wrong answer same session): 1.2s
    //   full   = first wrong answer: 2.1s
    const tone: 'short' | 'mid' | 'full' = reduced
      ? 'short'
      : isAbbreviated
        ? 'mid'
        : 'full'

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

  if (!word) return null

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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center backdrop-blur-md"
      style={{ background: 'var(--rescue-monster-veil)' }}
    >
      <div className="w-[300px] rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
        {/* Animation canvas: 280×280 */}
        <div className="relative mx-auto flex h-[280px] w-[280px] items-center justify-center">
          {/* Flying word chip — only rendered in enter/flying phases */}
          {(phase === 'enter' || phase === 'flying') && (
            <div
              className="absolute top-0 left-0 z-10 rounded-xl px-5 py-2 text-[22px] font-extrabold text-white whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg,#7F77DD,#5DCAA5)',
                boxShadow: '0 4px 18px rgba(127,119,221,.45)',
                // Pin to top-left of canvas; animate only transform + opacity (no layout thrashing).
                // translate(x,y) then translateX(-50%) centres the chip horizontally at position x.
                // CSS applies transforms right-to-left: -50% offset first, then (x,y) translation.
                transform: phase === 'enter'
                  ? `translate(${CANVAS_SIZE / 2}px, 10px) translateX(-50%) scale(1)`
                  : `translate(${targetLeft}px, ${targetTop - 18}px) translateX(-50%) scale(0.15) rotate(8deg)`,
                opacity: phase === 'flying' ? 0 : 1,
                transition: phase === 'flying'
                  ? 'transform .55s cubic-bezier(.55,0,.6,1), opacity .45s ease .15s'
                  : 'none',
                willChange: phase === 'enter' ? 'transform' : undefined,
              }}
            >
              {word}
            </div>
          )}

          {/* Monster SVG — string-level mouth toggle, entrance scale bounce */}
          <svg
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2"
            style={{
              transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
              transform:
                phase === 'enter'
                  ? 'translate(-50%,-50%) scale(.7)'
                  : 'translate(-50%,-50%) scale(1)',
            }}
            dangerouslySetInnerHTML={{ __html: monsterHtml }}
          />
        </div>

        {/* Message + dismiss button — only shown in done phase */}
        {phase === 'done' && (
          <>
            <div className="px-1 pb-2 text-center text-sm font-bold leading-relaxed text-[#3C3489] animate-[fade-up_.3s_ease]">
              {/* Title: raw template with {word} and {name} wrapped in <b> for rich HTML */}
              <div
                dangerouslySetInnerHTML={{
                  __html: titleTpl
                    .replace(/{word}/g, `<b style="color:#D85A30">${escapeHtml(word)}</b>`)
                    .replace(/{name}/g, `<b>${escapeHtml(monster.name)}</b>`),
                }}
              />
              <div className="mt-1 font-bold text-[#854F0B]">{sub}</div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2.5 w-full rounded-xl bg-[#534AB7] py-2.5 px-8 text-[15px] font-extrabold text-white transition hover:bg-[#3C3489]"
            >
              ⚔️ 知道啦，继续闯关！
            </button>
          </>
        )}
      </div>
    </div>
  )
}
