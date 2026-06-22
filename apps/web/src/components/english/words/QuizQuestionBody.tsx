'use client'

import { useMemo, type ReactNode } from 'react'
import type { WordEntry } from '@/utils/type'
import { findPassage, findSentenceForWord, blankWordInSentence } from '@/utils/reading-data'
import { pickMessage, RETRY_MC_MESSAGES } from '@/utils/constant'
import PhonicsWord from './PhonicsWord'
import SpeakButton from './SpeakButton'
import SpellTiles, { type SpellButtonStyle } from './SpellTiles'
import PassageHintModal from './PassageHintModal'
import WordHelpModal from './WordHelpModal'
import { letterCount } from '@/utils/english-helpers'
import type { QuizQuestion } from '@/utils/type'
import type { QuizRunnerState } from './useQuizRunner'

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
  /** Letter-reveal count so far for the current word (drives WordHelpModal progressive reveal). */
  helpRevealed?: number
  /** Called when the user clicks "再揭一个字母" — parent should increment its helpClicks counter. */
  onHelpReveal?: () => void
  /** Type C 拼写题字母池按钮样式：'candy' = SVG 水果（默认），'jelly' = 圆角果冻砖 */
  spellButtonStyle?: SpellButtonStyle
  /** When a monster-eat overlay is taking over advancing (WeeklyPlanSession only), suppress the inline 下一题 button. Optional; defaults false so other callers are unaffected. */
  eatenSceneActive?: boolean
}

export default function QuizQuestionBody({
  question,
  options,
  score,
  total,
  runner,
  progressSlot,
  questionKey,
  helpRevealed = 0,
  onHelpReveal,
  spellButtonStyle,
  eatenSceneActive = false,
}: QuizQuestionBodyProps) {
  const isA = question.type === 'A'
  const isB = question.type === 'B'
  const isC = question.type === 'C'
  const isD = question.type === 'D'
  const isMultiChoice = isA || isB || isD

  const retryHintMC = useMemo(() => pickMessage(RETRY_MC_MESSAGES), [questionKey])

  const passage = findPassage(question.word.stage, question.word.unit, question.word.lesson)
  const passageSentence = passage ? findSentenceForWord(passage, question.word.word) : null
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
      <div className="@container flex w-full max-w-[1000px] flex-col gap-4 rounded-[20px] border border-white/[.08] bg-white/[.04] p-[clamp(1rem,3.5cqi,1.75rem)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-block w-fit rounded-full px-3 py-1 text-[clamp(.62rem,1.8cqi,.72rem)] font-extrabold tracking-wider uppercase ${badgeStyle}`}
          >
            {badgeText}
          </span>
          <div className="text-[clamp(.72rem,2cqi,.82rem)] font-bold text-white/[.32]">
            ✓ {score} / {total}
          </div>
        </div>

        {progressSlot}

        {isD && dSentence ? (
          <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4">
            <div className="mb-2 text-[clamp(.62rem,1.6cqi,.72rem)] font-extrabold tracking-[.14em] text-amber-700 uppercase">
              📖 来自 {question.word.unit} · {question.word.lesson} 课文
            </div>
            <div className="text-[clamp(1.1rem,3.2cqi,1.7rem)] leading-relaxed font-bold text-amber-950">
              “{blankWordInSentence(dSentence.sentence, question.word.word)}”
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
                  word={question.word.word}
                  size="text-[1.2rem]"
                  className="opacity-50 hover:opacity-100 shrink-0"
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
              <button
                onClick={runner.openPassageHint}
                title="看课文上下文"
                className="font-nunito group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[.08] px-2 py-0.5 text-[clamp(.62rem,1.8cqi,.7rem)] font-extrabold text-amber-300 transition hover:-translate-y-px hover:border-amber-400/60 hover:bg-amber-500/[.18]"
              >
                <span aria-hidden className="text-[.95em] transition-transform group-hover:scale-110">
                  💡
                </span>
                <span>提示</span>
              </button>
            )}
            {showHelpAvailable && (
              <button
                onClick={runner.openHelp}
                title="揭一个字母（练习结束后会多巩固一次）"
                className="font-nunito group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-sky-400/40 bg-gradient-to-r from-sky-400/[.12] to-indigo-400/[.12] px-2 py-0.5 text-[clamp(.62rem,1.8cqi,.7rem)] font-extrabold text-sky-300 transition hover:-translate-y-px hover:border-sky-300/70 hover:from-sky-400/[.22] hover:to-indigo-400/[.22]"
              >
                <span aria-hidden className="text-[.95em] transition-transform group-hover:rotate-[8deg] group-hover:scale-110">
                  🎈
                </span>
                <span>帮助</span>
              </button>
            )}
          </div>
        </div>

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
                cls = 'border-[#4ade80] bg-[rgba(74,222,128,.12)] text-[#4ade80] shadow-[0_0_16px_rgba(74,222,128,.18)]'
                labelCls = 'text-[#4ade80]/70'
              } else if (isWrongAttempted) {
                cls = 'bg-white/[.03] border-white/[.12] text-white/40 opacity-45 transition-opacity duration-200'
                labelCls = 'text-white/20'
              }
              const label = ['A', 'B', 'C', 'D'][optIdx] ?? String(optIdx + 1)
              return (
                <button
                  key={o.word}
                  disabled={runner.answered || isWrongAttempted}
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
                  <span>{isA || isD ? o.word : o.explanation}</span>
                </button>
              )
            })}
          </div>
        )}

        {isMultiChoice && runner.attempt === 'retry' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-[var(--rescue-half)]/40 bg-[rgba(96,165,250,.08)] px-4 py-3 text-center text-[.9rem] font-bold text-[#93c5fd] animate-[fade-up_.2s_ease] shadow-[0_0_20px_rgba(96,165,250,.08)]"
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
          />
        )}

        {runner.attempt === 'done' && runner.wasCorrect === false && !eatenSceneActive && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={runner.requestAdvance}
              className="font-nunito cursor-pointer rounded-xl border-0 bg-gradient-to-br from-[#6d28d9] to-[#a855f7] px-7 py-[clamp(.6rem,2cqi,.8rem)] text-[clamp(.88rem,2.8cqi,1rem)] font-extrabold text-white shadow-[0_3px_12px_rgba(109,40,217,.35)] transition-all hover:-translate-y-0.5"
            >
              下一题 →
            </button>
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
          revealed={(() => {
            // 累加揭示：第 N 次点击 → 多揭 N 个字母 → 累计揭示 1+2+...+N = N(N+1)/2 个
            // 若超过总字母数（或剩余 < 本次量），一次给完整个单词。
            const total = letterCount(question.word.word)
            const triangular = (helpRevealed * (helpRevealed + 1)) / 2
            return Math.min(triangular, total)
          })()}
          onReveal={onHelpReveal}
          onClose={runner.closeHelp}
        />
      )}
    </>
  )
}
