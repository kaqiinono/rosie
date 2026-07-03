'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { useImmersive } from '@rosie/core'
import { useStarHud, StarProgressBar, ColoredStar } from '@rosie/rewards'
import { useChineseContext } from '../../context/ChineseContext'
import {
  MOON_REWARDS,
  buildPracticeSessionPlan,
  filterLessons,
  parseQuizTypesParam,
  type CharPracticeQuestion,
  type PracticePhase,
} from '../../utils/chinese-chars-session-helpers'
import { buildPhraseOptions } from '../../utils/chinese-phrase-helpers'
import { shuffle } from '../../utils/chinese-helpers'
import CharFlashCard from './CharFlashCard'
import CharWriter from './CharWriter'
import PinyinWriteRunner from './PinyinWriteRunner'
import QuizBlankSentence from './QuizBlankSentence'
import PoemRecite from '../poems/PoemRecite'
import { ACCUMULATION_KIND_LABEL } from '../../utils/chinese-accumulation-helpers'

const PHASE_LABEL: Record<PracticePhase, string> = {
  cards: '生字卡片',
  chars: '文字练习',
  phrases: '词汇练习',
  poems: '古诗词',
  accumulation: '日积月累',
  passage: '阅读题',
  'pinyin-write': '看拼写字',
  done: '练习结算',
}

function parseUnits(raw: string | null): Set<number> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n)),
  )
}

function parseLessons(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

function WrongAnswerPanel({
  correct,
  onNext,
}: {
  correct: string
  onNext: () => void
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-center">
      <p className="text-sm font-bold text-rose-700">再想想看～正确答案是「{correct}」</p>
      <button
        type="button"
        onClick={onNext}
        className="cn-start-btn mt-3 cursor-pointer rounded-xl border-0 px-5 py-2 text-sm font-bold text-white"
      >
        下一题
      </button>
    </div>
  )
}

export default function ChineseCharsPracticeSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setIsImmersive } = useImmersive()
  const { awardStars, session: starSession } = useStarHud()
  const { lessons, lessonGroups, charByKey, getCharProfile, recordBatch, isCharDataReady, bookSlug } =
    useChineseContext()

  const selUnits = useMemo(() => parseUnits(searchParams.get('units')), [searchParams])
  const selLessons = useMemo(() => parseLessons(searchParams.get('lessons')), [searchParams])
  const quizTypes = useMemo(
    () => parseQuizTypesParam(searchParams.get('types')),
    [searchParams],
  )
  const cardPreviewEnabled = searchParams.get('cardPreview') !== '0'

  const filtered = useMemo(
    () =>
      isCharDataReady
        ? filterLessons(lessons, lessonGroups, selUnits, selLessons)
        : [],
    [isCharDataReady, lessons, lessonGroups, selUnits, selLessons],
  )

  const plan = useMemo(
    () => buildPracticeSessionPlan(filtered, charByKey, quizTypes, lessons, bookSlug),
    [filtered, charByKey, quizTypes, lessons, bookSlug],
  )

  const [phase, setPhase] = useState<PracticePhase>(() =>
    cardPreviewEnabled ? 'cards' : 'chars',
  )
  const [cardIdx, setCardIdx] = useState(0)
  const [charQIdx, setCharQIdx] = useState(0)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [poemIdx, setPoemIdx] = useState(0)
  const [accIdx, setAccIdx] = useState(0)
  const [passageIdx, setPassageIdx] = useState(0)
  const [pinyinWriteIdx, setPinyinWriteIdx] = useState(0)
  const [flipped, setFlipped] = useState(true)
  const [wrongFeedback, setWrongFeedback] = useState<{
    selected: string
    correct: string
  } | null>(null)
  const [strokeWrongMistakes, setStrokeWrongMistakes] = useState<number | null>(null)
  const [earnedMoons, setEarnedMoons] = useState(0)
  const [correctCounts, setCorrectCounts] = useState({ total: 0, correct: 0 })

  useEffect(() => {
    setIsImmersive(true)
    return () => setIsImmersive(false)
  }, [setIsImmersive])

  const exitPractice = useCallback(() => {
    setIsImmersive(false)
    router.push('/chinese/chars')
  }, [router, setIsImmersive])

  const awardMoon = useCallback(
    async (amount: number, correct: boolean) => {
      setCorrectCounts((prev) => ({
        total: prev.total + 1,
        correct: prev.correct + (correct ? 1 : 0),
      }))
      if (correct && amount > 0) {
        setEarnedMoons((m) => m + amount)
        await awardStars('red', amount)
      }
    },
    [awardStars],
  )

  const goNextPhase = useCallback(
    (from: PracticePhase) => {
      const order: PracticePhase[] = [
        'cards',
        'chars',
        'phrases',
        'poems',
        'accumulation',
        'passage',
        'pinyin-write',
        'done',
      ]
      const start = order.indexOf(from) + 1
      for (let i = start; i < order.length; i++) {
        const next = order[i]
        if (next === 'cards' && (!cardPreviewEnabled || plan.cards.length === 0)) continue
        if (next === 'chars' && plan.charQuestions.length === 0) continue
        if (next === 'phrases' && plan.phraseItems.length === 0) continue
        if (next === 'poems' && plan.poems.length === 0) continue
        if (next === 'accumulation' && plan.accumulationItems.length === 0) continue
        if (next === 'passage' && plan.passageItems.length === 0) continue
        if (next === 'pinyin-write' && plan.pinyinWriteItems.length === 0) continue
        setPhase(next)
        return
      }
      setPhase('done')
    },
    [plan, cardPreviewEnabled],
  )

  useEffect(() => {
    if (!isCharDataReady) return
    if (phase === 'cards' && (!cardPreviewEnabled || plan.cards.length === 0)) {
      goNextPhase('cards')
      return
    }
    if (!cardPreviewEnabled && phase === 'chars' && plan.charQuestions.length === 0) {
      goNextPhase('chars')
    }
  }, [
    isCharDataReady,
    plan.cards.length,
    plan.charQuestions.length,
    phase,
    goNextPhase,
    cardPreviewEnabled,
  ])

  const currentCard = plan.cards[cardIdx]
  const currentCharQ = plan.charQuestions[charQIdx] as CharPracticeQuestion | undefined
  const currentPhrase = plan.phraseItems[phraseIdx]
  const currentPoem = plan.poems[poemIdx]
  const currentAcc = plan.accumulationItems[accIdx]
  const currentPassage = plan.passageItems[passageIdx]
  const currentPinyinWrite = plan.pinyinWriteItems[pinyinWriteIdx]

  const phraseOptions = useMemo(() => {
    if (!currentPhrase) return []
    const pool = filtered.flatMap((f) => [...f.group.recognize, ...f.group.write])
    const seed = currentPhrase.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 11) >>> 0
    return buildPhraseOptions(currentPhrase, [...new Set(pool)], seed)
  }, [currentPhrase, filtered])

  const passageOptions = currentPassage?.options ?? []

  const phraseCharOptions = useMemo(() => {
    if (!currentCharQ || currentCharQ.kind !== 'phrase-char') return []
    const pool = filtered.flatMap((f) => [...f.group.recognize, ...f.group.write])
    const seed =
      currentCharQ.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 11) >>> 0
    return buildPhraseOptions(currentCharQ.item, [...new Set(pool)], seed)
  }, [currentCharQ, filtered])

  const clearQuestionFeedback = useCallback(() => {
    setWrongFeedback(null)
    setStrokeWrongMistakes(null)
  }, [])

  const advanceCharQuestion = useCallback(() => {
    clearQuestionFeedback()
    if (charQIdx + 1 >= plan.charQuestions.length) {
      goNextPhase('chars')
      setCharQIdx(0)
    } else {
      setCharQIdx((i) => i + 1)
    }
  }, [charQIdx, clearQuestionFeedback, goNextPhase, plan.charQuestions.length])

  const advancePhraseQuestion = useCallback(() => {
    clearQuestionFeedback()
    if (phraseIdx + 1 >= plan.phraseItems.length) {
      goNextPhase('phrases')
      setPhraseIdx(0)
    } else {
      setPhraseIdx((i) => i + 1)
    }
  }, [clearQuestionFeedback, goNextPhase, phraseIdx, plan.phraseItems.length])

  const advancePassageQuestion = useCallback(() => {
    clearQuestionFeedback()
    if (passageIdx + 1 >= plan.passageItems.length) {
      goNextPhase('passage')
      setPassageIdx(0)
    } else {
      setPassageIdx((i) => i + 1)
    }
  }, [clearQuestionFeedback, goNextPhase, passageIdx, plan.passageItems.length])

  const advanceAccQuestion = useCallback(() => {
    clearQuestionFeedback()
    if (accIdx + 1 >= plan.accumulationItems.length) {
      goNextPhase('accumulation')
      setAccIdx(0)
    } else {
      setAccIdx((i) => i + 1)
    }
  }, [accIdx, clearQuestionFeedback, goNextPhase, plan.accumulationItems.length])

  const handleChoiceAnswer = useCallback(
    async (
      correct: boolean,
      reward: number,
      advance: () => void,
      wrong?: { selected: string; correct: string },
    ) => {
      await awardMoon(reward, correct)
      if (correct) {
        advance()
      } else if (wrong) {
        setWrongFeedback(wrong)
      }
    },
    [awardMoon],
  )

  const handleCharAnswer = useCallback(
    async (
      correct: boolean,
      q: CharPracticeQuestion,
      wrong?: { selected: string; correct: string },
    ) => {
      if (q.kind === 'recognize') {
        recordBatch([{ charKey: q.charKey, track: 'recognize', correct }])
      } else if (q.kind === 'stroke') {
        recordBatch([{ charKey: q.charKey, track: 'write', correct }])
      }
      await awardMoon(MOON_REWARDS.char, correct)
      if (correct) {
        advanceCharQuestion()
      } else if (wrong) {
        setWrongFeedback(wrong)
      }
    },
    [advanceCharQuestion, awardMoon, recordBatch],
  )

  if (!isCharDataReady) {
    return <p className="p-6 text-center text-sm text-amber-900/50">字库未就绪</p>
  }

  if (filtered.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-stone-600">没有可练习的内容，请返回重新筛选。</p>
        <button
          type="button"
          onClick={exitPractice}
          className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white"
        >
          返回生字库
        </button>
      </div>
    )
  }

  return (
    <div className="cn-immersive-bg fixed inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-4">
        <header className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={exitPractice}
            className="cursor-pointer rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-sm font-bold text-amber-900/60 hover:border-amber-400"
          >
            ← 退出
          </button>
          <span className="text-sm font-extrabold text-stone-800">{PHASE_LABEL[phase]}</span>
          <div className="ml-auto flex items-center gap-1 text-xs font-bold text-rose-700">
            <ColoredStar color="red" size={16} />
            {starSession.red}
          </div>
        </header>

        {phase !== 'done' && (
          <div className="mb-4 rounded-2xl border border-rose-200/70 bg-white/75 px-4 py-2.5">
            <StarProgressBar
              color="red"
              target={Math.max(1, plan.possibleMoons)}
              label="本次红月亮"
              compact
            />
          </div>
        )}

        {phase === 'cards' && currentCard && (
          <div className="flex flex-1 flex-col">
            <p className="mb-3 text-center text-xs font-semibold text-amber-900/45">
              卡片 {cardIdx + 1} / {plan.cards.length}
            </p>
            <CharFlashCard
              data={{
                char: currentCard.char,
                pinyin: currentCard.pinyin,
                unit: currentCard.unit,
                unitLessonNo: currentCard.unitLessonNo,
                bookLessonNo: currentCard.bookLessonNo,
                lessonTitle: currentCard.lessonTitle,
                radical: getCharProfile(currentCard.charKey)?.radical,
                radicalName: getCharProfile(currentCard.charKey)?.radicalName,
                structure: getCharProfile(currentCard.charKey)?.structure,
                phrases: getCharProfile(currentCard.charKey)?.phrases,
                strokeCount: getCharProfile(currentCard.charKey)?.strokeCount,
              }}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={cardIdx === 0}
                onClick={() => {
                  setCardIdx((i) => i - 1)
                  setFlipped(true)
                }}
                className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
              >
                上一字
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cardIdx + 1 >= plan.cards.length) {
                    goNextPhase('cards')
                    setCardIdx(0)
                    setFlipped(true)
                  } else {
                    setCardIdx((i) => i + 1)
                    setFlipped(true)
                  }
                }}
                className="cn-start-btn rounded-xl border-0 px-5 py-2 text-sm font-bold text-white"
              >
                {cardIdx + 1 >= plan.cards.length ? '开始测验' : '下一字'}
              </button>
            </div>
          </div>
        )}

        {phase === 'chars' && currentCharQ && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              文字练习 {charQIdx + 1} / {plan.charQuestions.length}
            </p>

            {currentCharQ.kind === 'recognize' && (
              <>
                <div className="text-center">
                  <p className="text-sm text-stone-500">选出正确的拼音</p>
                  <div className="mt-4 flex justify-center">
                    <span className="cn-grid-cell">{currentCharQ.char}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const pool = [...new Set(plan.cards.map((c) => c.pinyin))]
                    const seed =
                      currentCharQ.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0
                    const distractors = shuffle(
                      pool.filter((p) => p !== currentCharQ.pinyin),
                      seed,
                    ).slice(0, 3)
                    while (distractors.length < 3) distractors.push(currentCharQ.pinyin)
                    const opts = shuffle([currentCharQ.pinyin, ...distractors.slice(0, 3)], seed + 1)
                    return opts.map((opt) => {
                      const locked = wrongFeedback !== null
                      const isCorrect = opt === currentCharQ.pinyin
                      const isChosen = wrongFeedback?.selected === opt
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            const correct = opt === currentCharQ.pinyin
                            void handleCharAnswer(
                              correct,
                              currentCharQ,
                              correct ? undefined : { selected: opt, correct: currentCharQ.pinyin },
                            )
                          }}
                          className={clsx(
                            'rounded-xl border-2 px-4 py-3 text-lg font-semibold',
                            !locked && 'border-amber-200 bg-white hover:border-sky-300',
                            locked && isCorrect && 'border-emerald-400 bg-emerald-50',
                            locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50',
                            locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
                          )}
                        >
                          {opt}
                        </button>
                      )
                    })
                  })()}
                </div>
                {wrongFeedback && currentCharQ.kind === 'recognize' && (
                  <WrongAnswerPanel
                    correct={wrongFeedback.correct}
                    onNext={advanceCharQuestion}
                  />
                )}
              </>
            )}

            {currentCharQ.kind === 'stroke' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-stone-600">按笔顺书写「{currentCharQ.char}」</p>
                {strokeWrongMistakes === null ? (
                  <CharWriter
                    char={currentCharQ.char}
                    mode="quiz"
                    onQuizComplete={({ totalMistakes }) => {
                      if (totalMistakes === 0) {
                        void handleCharAnswer(true, currentCharQ)
                      } else {
                        void (async () => {
                          if (currentCharQ.kind === 'stroke') {
                            recordBatch([
                              { charKey: currentCharQ.charKey, track: 'write', correct: false },
                            ])
                          }
                          await awardMoon(MOON_REWARDS.char, false)
                          setStrokeWrongMistakes(totalMistakes)
                        })()
                      }
                    }}
                  />
                ) : (
                  <>
                    <p className="text-sm font-bold text-rose-700">
                      有 {strokeWrongMistakes} 处笔误，再练练「{currentCharQ.char}」
                    </p>
                    <WrongAnswerPanel correct={currentCharQ.char} onNext={advanceCharQuestion} />
                  </>
                )}
              </div>
            )}

            {currentCharQ.kind === 'phrase-char' && (
              <>
                <div className="text-center">
                  <p className="text-sm font-semibold text-amber-800/70">
                    词语检测 · 选出彩色小空格里应该填的字
                  </p>
                  <div className="mt-4">
                    <QuizBlankSentence display={currentCharQ.item.display} size="lg" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {phraseCharOptions.map((opt) => {
                    const locked = wrongFeedback !== null
                    const isCorrect = opt === currentCharQ.item.answer
                    const isChosen = wrongFeedback?.selected === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          const correct = opt === currentCharQ.item.answer
                          void handleCharAnswer(
                            correct,
                            currentCharQ,
                            correct ? undefined : { selected: opt, correct: currentCharQ.item.answer },
                          )
                        }}
                        className={clsx(
                          'rounded-xl border-2 py-3 text-xl font-bold',
                          !locked && 'border-amber-200 bg-white',
                          locked && isCorrect && 'border-emerald-400 bg-emerald-50',
                          locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50',
                          locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
                        )}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {wrongFeedback && currentCharQ.kind === 'phrase-char' && (
                  <WrongAnswerPanel
                    correct={wrongFeedback.correct}
                    onNext={advanceCharQuestion}
                  />
                )}
              </>
            )}
          </div>
        )}

        {phase === 'phrases' && currentPhrase && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              词汇练习 {phraseIdx + 1} / {plan.phraseItems.length}
            </p>
            <QuizBlankSentence display={currentPhrase.display} size="lg" />
            <div className="grid grid-cols-4 gap-3">
              {phraseOptions.map((opt) => {
                const locked = wrongFeedback !== null
                const isCorrect = opt === currentPhrase.answer
                const isChosen = wrongFeedback?.selected === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      void handleChoiceAnswer(
                        opt === currentPhrase.answer,
                        MOON_REWARDS.phrase,
                        advancePhraseQuestion,
                        opt === currentPhrase.answer
                          ? undefined
                          : { selected: opt, correct: currentPhrase.answer },
                      )
                    }}
                    className={clsx(
                      'rounded-xl border-2 py-3 text-xl font-bold',
                      !locked && 'border-violet-200 bg-white',
                      locked && isCorrect && 'border-emerald-400 bg-emerald-50',
                      locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50',
                      locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {wrongFeedback && (
              <WrongAnswerPanel
                correct={wrongFeedback.correct}
                onNext={advancePhraseQuestion}
              />
            )}
          </div>
        )}

        {phase === 'poems' && currentPoem && (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 text-center text-xs font-semibold text-amber-900/45">
              古诗词 {poemIdx + 1} / {plan.poems.length}
            </p>
            <PoemRecite
              poem={currentPoem}
              onComplete={async (score) => {
                await awardMoon(MOON_REWARDS.poem, score >= 60)
                if (poemIdx + 1 >= plan.poems.length) {
                  goNextPhase('poems')
                  setPoemIdx(0)
                } else {
                  setPoemIdx((i) => i + 1)
                }
              }}
            />
          </div>
        )}

        {phase === 'accumulation' && currentAcc && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              日积月累 {accIdx + 1} / {plan.accumulationItems.length} ·{' '}
              {ACCUMULATION_KIND_LABEL[currentAcc.kind]}
            </p>
            <p className="text-center text-2xl font-bold">{currentAcc.prompt}</p>
            <div className="grid grid-cols-2 gap-3">
              {currentAcc.options.map((opt) => {
                const locked = wrongFeedback !== null
                const isCorrect = opt === currentAcc.answer
                const isChosen = wrongFeedback?.selected === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      void handleChoiceAnswer(
                        opt === currentAcc.answer,
                        MOON_REWARDS.accumulation,
                        advanceAccQuestion,
                        opt === currentAcc.answer
                          ? undefined
                          : { selected: opt, correct: currentAcc.answer },
                      )
                    }}
                    className={clsx(
                      'rounded-xl border-2 px-3 py-3 text-sm font-bold',
                      !locked && 'border-emerald-200 bg-white',
                      locked && isCorrect && 'border-emerald-400 bg-emerald-50',
                      locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50',
                      locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {wrongFeedback && (
              <WrongAnswerPanel
                correct={wrongFeedback.correct}
                onNext={advanceAccQuestion}
              />
            )}
          </div>
        )}

        {phase === 'passage' && currentPassage && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              阅读题 {passageIdx + 1} / {plan.passageItems.length}
            </p>
            <p className="text-center text-sm font-semibold text-amber-800/70">
              {currentPassage.blankKind === 'word'
                ? '选出句子里彩色小空格里应该填的词语'
                : '选出句子里彩色小空格里应该填的字'}
              {' · '}
              {currentPassage.lessonTitle}
            </p>
            <div className="rounded-2xl border border-amber-200/70 bg-white/85 p-4 shadow-sm">
              <QuizBlankSentence display={currentPassage.prompt} size="md" align="start" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {passageOptions.map((opt) => {
                const locked = wrongFeedback !== null
                const isCorrect = opt === currentPassage.answer
                const isChosen = wrongFeedback?.selected === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      void handleChoiceAnswer(
                        opt === currentPassage.answer,
                        MOON_REWARDS.passage,
                        advancePassageQuestion,
                        opt === currentPassage.answer
                          ? undefined
                          : { selected: opt, correct: currentPassage.answer },
                      )
                    }}
                    className={clsx(
                      'rounded-xl border-2 py-3 text-xl font-bold',
                      !locked && 'border-amber-300 bg-white',
                      locked && isCorrect && 'border-emerald-400 bg-emerald-50',
                      locked && isChosen && !isCorrect && 'border-rose-400 bg-rose-50',
                      locked && !isChosen && !isCorrect && 'border-slate-100 bg-slate-50 text-slate-400',
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {wrongFeedback && (
              <WrongAnswerPanel
                correct={wrongFeedback.correct}
                onNext={advancePassageQuestion}
              />
            )}
          </div>
        )}

        {phase === 'pinyin-write' && currentPinyinWrite && (
          <div className="flex flex-1 flex-col">
            <p className="mb-3 text-center text-xs font-semibold text-amber-900/45">
              看拼写字 {pinyinWriteIdx + 1} / {plan.pinyinWriteItems.length} ·{' '}
              {currentPinyinWrite.lessonTitle}
            </p>
            <PinyinWriteRunner
              key={currentPinyinWrite.id}
              item={currentPinyinWrite}
              onComplete={async (correct) => {
                await awardMoon(MOON_REWARDS.pinyinWrite, correct)
                if (pinyinWriteIdx + 1 >= plan.pinyinWriteItems.length) {
                  goNextPhase('pinyin-write')
                  setPinyinWriteIdx(0)
                } else {
                  setPinyinWriteIdx((i) => i + 1)
                }
              }}
            />
          </div>
        )}

        {phase === 'done' && (
          <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center rounded-3xl border border-amber-200/70 bg-white/85 p-8 text-center shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <ColoredStar color="red" size={36} />
              <span className="text-4xl font-black text-rose-700">{earnedMoons}</span>
            </div>
            <h2 className="text-xl font-extrabold text-stone-900">练习完成！</h2>
            <p className="mt-2 text-sm text-stone-500">
              正确 {correctCounts.correct} / {correctCounts.total} 题 · 获得 {earnedMoons} 个红月亮
            </p>
            <button
              type="button"
              onClick={exitPractice}
              className="cn-start-btn mt-6 rounded-xl border-0 px-6 py-2.5 text-sm font-bold text-white"
            >
              返回生字库
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
