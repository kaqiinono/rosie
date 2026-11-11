'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WordEntry } from '@rosie/core'
import { findPassage, findSentenceForWord, blankWordInSentence } from '../../utils/reading-data'
import { pickMessage, RETRY_MC_MESSAGES } from '@rosie/core'
import MagicWand, {
  CrystalWand,
  MAGIC_ARRIVAL_MS,
  MAGIC_LETTER_MS,
  MAGIC_TRAVEL_MS,
  MAGIC_CHARGE_MS,
  MAGIC_REVEAL_DELAY_MS,
} from './MagicWand'
import { acceptedSpellings } from '../../utils/english-helpers'
import PhonicsWord from './PhonicsWord'
import SpeakButton from './SpeakButton'
import SpellTiles, { type SpellButtonStyle } from './SpellTiles'
import PassageHintModal from './PassageHintModal'
import WordHelpModal from './WordHelpModal'
import type { QuizQuestion } from '@rosie/core'
import type { QuizRunnerState } from './useQuizRunner'
import { Button } from '@rosie/ui/themes'

interface QuizQuestionBodyProps {
  question: QuizQuestion
  options: WordEntry[]
  score: number
  total: number
  runner: QuizRunnerState
  /** Slot rendered between the badge row and the question stem (e.g. live star progress widget). */
  progressSlot?: ReactNode
  /** Stable key per question instance — used as React key on SpellTiles to force reset. */
  questionKey: string | number
  /** Marks this word as assisted for the current pass. Reveal counts stay local. */
  onHelpReveal?: () => void
  /** Marks assistance without advancing the letter-reveal hint. */
  onMagicReveal?: () => void
  /** Type C 拼写题字母池按钮样式：'candy' = SVG 水果（默认），'jelly' = 圆角果冻砖 */
  spellButtonStyle?: SpellButtonStyle
  /** When a monster-eat overlay is taking over advancing (WeeklyPlanSession only), suppress the inline 下一题 button. Optional; defaults false so other callers are unaffected. */
  eatenSceneActive?: boolean
}

export default function QuizQuestionBody(props: QuizQuestionBodyProps) {
  // The adaptive runner may reuse an index for the next reinforcement pass.
  const [instance, setInstance] = useState({ question: props.question, key: 0 })
  if (instance.question !== props.question) {
    setInstance({ question: props.question, key: instance.key + 1 })
  }
  return <QuestionBody key={instance.key} {...props} />
}

function QuestionBody({
  question,
  options,
  score,
  total,
  runner,
  progressSlot,
  questionKey,
  onHelpReveal,
  onMagicReveal,
  spellButtonStyle,
  eatenSceneActive = false,
}: QuizQuestionBodyProps) {
  const isA = question.type === 'A'
  const isB = question.type === 'B'
  const isC = question.type === 'C'
  const isD = question.type === 'D'
  const isMultiChoice = isA || isB || isD

  const container = useRef<HTMLDivElement>(null)
  const magicLock = useRef(false)
  const [helpRevealed, setHelpRevealed] = useState(0)
  const [magicRun, setMagicRun] = useState(0)
  const [magicPhase, setMagicPhase] = useState<
    'idle' | 'moving' | 'revealing' | 'holding' | 'fading'
  >('idle')
  const [magicLetters, setMagicLetters] = useState(0)
  const [magicTarget, setMagicTarget] = useState(0)
  const [magicCastTarget, setMagicCastTarget] = useState(-1)
  const [magicChoice, setMagicChoice] = useState(false)
  const [magicReset, setMagicReset] = useState(0)
  const magicBusy = magicPhase !== 'idle'
  const magicAnswer = useMemo(
    () =>
      acceptedSpellings(question.word.word).find((answer) => !/[()]/.test(answer)) ??
      question.word.word,
    [question.word.word],
  )

  useEffect(() => {
    if (!magicRun) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (action: () => void, delay: number) => timers.push(setTimeout(action, delay))
    if (isC) {
      const step = MAGIC_LETTER_MS
      for (let i = 0; i < magicAnswer.length; i++) {
        if (i > 0) later(() => setMagicTarget(i), MAGIC_ARRIVAL_MS + i * step - MAGIC_TRAVEL_MS)
        later(() => setMagicCastTarget(i), MAGIC_ARRIVAL_MS + i * step + MAGIC_CHARGE_MS)
        later(
          () => {
            setMagicPhase('revealing')
            setMagicLetters(i + 1)
          },
          MAGIC_ARRIVAL_MS + i * step + MAGIC_CHARGE_MS + MAGIC_REVEAL_DELAY_MS,
        )
      }
      const completeAt = MAGIC_ARRIVAL_MS + magicAnswer.length * step
      later(() => setMagicPhase('holding'), completeAt)
      later(() => setMagicPhase('fading'), completeAt + 1500)
      later(() => {
        setMagicReset((value) => value + 1)
        setMagicPhase('idle')
        magicLock.current = false
      }, completeAt + 1700)
    } else {
      later(() => setMagicCastTarget(0), MAGIC_ARRIVAL_MS + MAGIC_CHARGE_MS)
      later(
        () => {
          setMagicChoice(true)
          setMagicPhase('holding')
        },
        MAGIC_ARRIVAL_MS + MAGIC_CHARGE_MS + MAGIC_REVEAL_DELAY_MS,
      )
      later(() => {
        setMagicPhase('idle')
        magicLock.current = false
      }, MAGIC_ARRIVAL_MS + 600)
    }
    return () => timers.forEach(clearTimeout)
  }, [magicRun, isC, magicAnswer])

  const startMagic = () => {
    if (magicLock.current || runner.answered) return
    magicLock.current = true
    onMagicReveal?.()
    runner.closeHelp()
    runner.closePassageHint()
    setMagicLetters(0)
    setMagicTarget(0)
    setMagicCastTarget(-1)
    setMagicPhase('moving')
    setMagicRun((value) => value + 1)
  }

  const [retryHintMC] = useState(() => pickMessage(RETRY_MC_MESSAGES))

  const passage = findPassage(question.word.stage, question.word.unit, question.word.lesson)
  const passageSentence = passage ? findSentenceForWord(passage, question.word) : null
  const hasPassageContext = passage !== undefined && passageSentence !== null
  const dSentence = isD ? passageSentence : null

  const badgeStyle = isA
    ? 'bg-[rgba(96,165,250,.15)] text-[#60a5fa]'
    : isC
      ? 'bg-[rgba(74,222,128,.12)] text-[#4ade80]'
      : isD
        ? 'bg-[rgba(245,158,11,.18)] text-[#fbbf24]'
        : 'bg-[rgba(167,139,250,.15)] text-[#a78bfa]'
  const badgeText = isA
    ? '题型 A · 看释义选单词'
    : isC
      ? '题型 C · 看释义默写单词 (+2⭐/题)'
      : isD
        ? '📖 题型 D · 课文语境填空 (+2⭐/题)'
        : '题型 B · 看单词选释义'

  const vocabTypeStyle =
    question.word.vocabType === 'Target'
      ? 'border-emerald-400/30 bg-emerald-400/[.12] text-emerald-300'
      : question.word.vocabType === 'Context'
        ? 'border-amber-400/30 bg-amber-400/[.12] text-amber-300'
        : 'border-violet-400/30 bg-violet-400/[.12] text-violet-300'

  const promptText = isA
    ? '请选出对应的英文单词：'
    : isC
      ? '请拼写出对应的英文单词或短语：'
      : isD
        ? '请选出填入空格的单词或短语：'
        : '请选出正确的释义：'

  const showHintAvailable = !runner.answered && hasPassageContext && !isD
  // Help button shows the word's own example with progressive letter reveal — only
  // useful when (a) the example exists and (b) the user hasn't answered yet.
  // Available across all 4 types; for Type B (word already visible) it still serves
  // as a comprehension hint via the example sentence.
  const showHelpAvailable = !runner.answered && !!question.word.example && !!onHelpReveal

  return (
    <>
      <div
        ref={container}
        className="@container relative flex w-full max-w-[1000px] flex-col gap-4 rounded-[20px] border border-white/[.08] bg-white/[.04] p-[clamp(1rem,3.5cqi,1.75rem)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block w-fit rounded-full px-3 py-1 text-[clamp(.62rem,1.8cqi,.72rem)] font-extrabold tracking-wider uppercase ${badgeStyle}`}
            >
              {badgeText}
            </span>
            {question.word.vocabType && (
              <span
                className={`inline-block rounded-full border px-2.5 py-1 text-[clamp(.6rem,1.7cqi,.7rem)] font-extrabold tracking-wider uppercase ${vocabTypeStyle}`}
                title="单词属性"
              >
                {question.word.vocabType}
              </span>
            )}
          </div>
          <div className="text-[clamp(.72rem,2cqi,.82rem)] font-bold text-white/[.32]">
            ✓ {score} / {total}
          </div>
        </div>

        {progressSlot}

        {isD && dSentence ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4">
            <div className="mb-2 text-[clamp(.62rem,1.6cqi,.72rem)] font-extrabold tracking-[.14em] text-amber-700 uppercase">
              📖 来自 {question.word.unit} · {question.word.lesson} 课文
            </div>
            <div className="text-[clamp(1.1rem,3.2cqi,1.7rem)] leading-relaxed font-bold text-amber-950">
              “{blankWordInSentence(dSentence.sentence, question.word)}”
            </div>
          </div>
        ) : (
          <div className="text-[clamp(1.3rem,4cqi,2.5rem)] leading-relaxed font-black text-[#f0f0ff]">
            {isA || isC ? (
              question.word.explanation
            ) : (
              <div className="flex items-center gap-2">
                <PhonicsWord text={question.word.word} syllables={question.word.syllables} />
                <SpeakButton
                  entry={question.word}
                  word={question.word.word}
                  size="2"
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        )}

        {isB && question.word.ipa && (
          <div className="text-[clamp(.8rem,2.5cqi,.95rem)] font-semibold text-[#f0abfc] italic">
            {question.word.ipa}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[clamp(.78rem,2.2cqi,.9rem)] font-semibold text-white/[.38]">
            {promptText}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {showHintAvailable && (
              <Button
                disabled={magicBusy}
                onClick={runner.openPassageHint}
                title="看课文上下文"
                variant="outline"
                color="amber"
                size="1"
                className="shrink-0"
              >
                <span
                  aria-hidden
                  className="text-[.95em] transition-transform group-hover:scale-110"
                >
                  💡
                </span>
                <span>提示</span>
              </Button>
            )}
            {showHelpAvailable && (
              <Button
                disabled={magicBusy}
                onClick={runner.openHelp}
                title="揭一个字母（本轮每词最多追加一次巩固）"
                variant="solid"
                color="indigo"
                size="1"
                className="shrink-0"
              >
                <span
                  aria-hidden
                  className="text-[.95em] transition-transform group-hover:scale-110 group-hover:rotate-[8deg]"
                >
                  🎈
                </span>
                <span>帮助</span>
              </Button>
            )}
            {onMagicReveal && !runner.answered && (
              <Button
                type="button"
                data-magic-source
                disabled={magicBusy}
                onClick={startMagic}
                title="演示正确答案，再由你亲自作答；本轮会追加一次巩固"
                variant="soft"
                color="cyan"
                size="1"
                className="shrink-0"
              >
                <span
                  style={{
                    width: 16,
                    height: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    transform: 'rotate(-25deg)',
                    overflow: 'visible',
                  }}
                >
                  <CrystalWand width={16} height={24} />
                </span>
                <span className="whitespace-nowrap">魔法棒</span>
              </Button>
            )}
          </div>
        </div>

        {magicBusy && (
          <span role="status" className="sr-only">
            {magicPhase === 'holding' ? '记住了吗？轮到你啦' : '正在演示正确答案'}
          </span>
        )}
        {magicBusy && (
          <MagicWand
            container={container}
            target={isC ? `[data-magic-slot="${magicTarget}"]` : '[data-magic-correct]'}
            burst={magicCastTarget === magicTarget && (!isC || magicAnswer[magicTarget] !== ' ')}
          />
        )}

        {isMultiChoice && (
          <div
            className={`grid gap-[clamp(.4rem,1.5cqi,.6rem)] ${isB ? 'grid-cols-1' : 'grid-cols-1 @lg:grid-cols-2'}`}
          >
            {options.map((o, optIdx) => {
              const isCorrect = o.word === question.word.word
              const isWrongAttempted = runner.wrongChoices.has(o.word)
              let cls = 'bg-white/[.04] border-white/[.09] text-[#f0f0ff]'
              let labelCls = 'text-[#a78bfa]/60'
              if (runner.answered && isCorrect) {
                cls =
                  'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80] shadow-[0_0_16px_rgba(74,222,128,.18)]'
                labelCls = 'text-[#4ade80]/70'
              } else if (magicChoice && isCorrect) {
                cls =
                  'border-amber-300/70 bg-amber-300/10 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,.15)]'
                labelCls = 'text-amber-200'
              } else if (isWrongAttempted) {
                cls =
                  'bg-white/[.03] border-white/[.12] text-white/40 opacity-45 transition-opacity duration-200'
                labelCls = 'text-white/20'
              }
              const label = ['A', 'B', 'C', 'D'][optIdx] ?? String(optIdx + 1)
              return (
                // native-ok: 测验选项卡，多块内容（字母 + 释义 + 魔法提示），按答题/魔法状态着色并随容器查询缩放，且被魔法棒演示按 data-magic-correct 定位
                <button
                  key={o.word}
                  data-magic-correct={isCorrect ? true : undefined}
                  disabled={magicBusy || runner.answered || isWrongAttempted}
                  onClick={() => runner.handleMCAnswer(o.word)}
                  className={`font-nunito flex cursor-pointer items-start gap-[clamp(.4rem,1.2cqi,.6rem)] rounded-xl border-2 px-[clamp(.6rem,2cqi,.9rem)] py-[clamp(.7rem,2.5cqi,1rem)] text-left text-[clamp(1.2rem,2.2cqi,1rem)] leading-snug font-bold break-words transition-all disabled:cursor-default ${cls} ${
                    !runner.answered && !isWrongAttempted
                      ? 'hover:border-[#a78bfa] hover:bg-[rgba(167,139,250,.1)]'
                      : ''
                  }`}
                >
                  <span className={`shrink-0 font-extrabold tabular-nums ${labelCls}`}>
                    {label}.
                  </span>
                  <span>
                    {isA || isD ? o.word : o.explanation}
                    {magicChoice && isCorrect && !runner.answered && (
                      <span className="ml-2 inline-block text-xs text-amber-200">✨ 正确答案</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {isMultiChoice && runner.attempt === 'retry' && (
          <div
            role="status"
            aria-live="polite"
            className="animate-[fade-up_.2s_ease] rounded-2xl border border-[var(--rescue-half)]/40 bg-[rgba(96,165,250,.08)] px-4 py-3 text-center text-[.9rem] font-bold text-[#93c5fd] shadow-[0_0_20px_rgba(96,165,250,.08)]"
          >
            {retryHintMC}
          </div>
        )}

        {isC && (
          <SpellTiles
            key={questionKey}
            word={question.word.word}
            onSubmit={runner.handleSpellSubmit}
            answered={runner.answered}
            isCorrect={runner.spellOk}
            attempt={runner.attempt}
            onRetryAcknowledged={runner.acknowledgeSpellRetry}
            revealedHalf={question.revealedHalf}
            buttonStyle={spellButtonStyle}
            magicDemo={
              magicBusy
                ? {
                    answer: magicAnswer,
                    count: magicLetters,
                    fading: magicPhase === 'fading',
                    holding: magicPhase === 'holding',
                  }
                : undefined
            }
            magicReset={magicReset}
          />
        )}

        {runner.attempt === 'done' && runner.wasCorrect === false && !eatenSceneActive && (
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={runner.requestAdvance} variant="solid" color="violet" size="2">
              下一题 →
            </Button>
          </div>
        )}
      </div>

      {hasPassageContext && passageSentence && (
        <PassageHintModal
          open={runner.showPassageHint}
          word={question.word}
          sentence={passageSentence.sentence}
          onClose={runner.closePassageHint}
        />
      )}

      {onHelpReveal && (
        <WordHelpModal
          open={runner.showHelp}
          word={question.word}
          helpClicks={helpRevealed}
          onReveal={() => {
            setHelpRevealed((count) => count + 1)
            onHelpReveal()
          }}
          onClose={runner.closeHelp}
        />
      )}
    </>
  )
}
