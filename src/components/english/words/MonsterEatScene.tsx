'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MONSTERS } from './monsters'
import { EATEN_TITLE_MESSAGES, EATEN_SUB_MESSAGES, pickMessage } from '@/utils/constant'

interface Props {
  /** 不为 null 时显示弹层；null = 隐藏 */
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
    // Re-randomise each time a new word is shown
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
  const svgScale = 220 / 200
  const monsterOff = (280 - 220) / 2 // 30px offset on each side
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
              className="absolute z-10 rounded-xl px-5 py-2 text-[22px] font-extrabold text-white whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg,#7F77DD,#5DCAA5)',
                boxShadow: '0 4px 18px rgba(127,119,221,.45)',
                // In enter phase: centred at top of canvas
                // In flying phase: animated toward mouth position, shrunk + faded
                top: phase === 'enter' ? 10 : targetTop - 18,
                left: phase === 'enter' ? '50%' : targetLeft,
                transform:
                  phase === 'enter'
                    ? 'translateX(-50%) scale(1)'
                    : 'translateX(-50%) scale(0.15) rotate(8deg)',
                opacity: phase === 'flying' ? 0 : 1,
                transition:
                  phase === 'flying'
                    ? 'top .55s cubic-bezier(.55,0,.6,1), left .55s cubic-bezier(.55,0,.6,1), transform .55s cubic-bezier(.55,0,.6,1), opacity .45s ease .15s'
                    : 'none',
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
                    .replace(
                      /{word}/g,
                      `<b style="color:#D85A30">${word}</b>`,
                    )
                    .replace(/{name}/g, `<b>${monster.name}</b>`),
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
