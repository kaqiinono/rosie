'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { todayStr, useAuth, useImmersive, usePracticePendingLifecycle } from '@rosie/core'
import { useStarHud, StarProgressBar, ColoredStar } from '@rosie/rewards'
import { useChineseContext } from '../../context/ChineseContext'
import { useChineseRoadmapPlan } from '../../hooks/useChineseRoadmapPlan'
import {
  MOON_REWARDS,
  buildPracticeSessionPlan,
  filterLessons,
  parseQuizTypesParam,
  type CharCardItem,
  type CharPracticeQuestion,
  type PassageStep,
  type PracticePhase,
  type PracticeSessionPlan,
} from '../../utils/chinese-chars-session-helpers'
import { buildPhraseOptions } from '../../utils/chinese-phrase-helpers'
import { findLessonRow, getLessonGroup, parseBookSlug, shuffle } from '../../utils/chinese-helpers'
import { getLessonPassage } from '../../utils/chinese-lesson-passage-helpers'
import { getLessonDisplayInfo, sortLessonsPedagogically } from '../../utils/chinese-lesson-display'
import {
  CHINESE_PENDING_KIND,
  CHINESE_PRACTICE_SNAPSHOT_VERSION,
  chinesePracticeScopeKey,
  clearChinesePendingEverywhere,
  resolveChinesePracticeSnapshot,
  wrapChineseEnvelope,
  writeChinesePracticeSnapshot,
  type LessonTypeStats,
} from '../../utils/chinese-practice-session-snapshot'
import {
  computeAdvanceAfterBatch,
  isLessonCompleteForPlan,
  poemMatchesLessonMeta,
  summarizeLessonPhases,
} from '../../utils/chineseRoadmapPlanLogic'
import type { PoemEntry } from '../../utils/g1b/types'
import CharFlashCard from './CharFlashCard'
import CharWriter from './CharWriter'
import PinyinWriteRunner from './PinyinWriteRunner'
import QuizBlankSentence from './QuizBlankSentence'
import PoemRecite from '../poems/PoemRecite'
import LessonPassageReader from '../reading/LessonPassageReader'
import PassageRecorder from '../reading/PassageRecorder'
import { ACCUMULATION_KIND_LABEL } from '../../utils/chinese-accumulation-helpers'

const PHASE_LABEL: Record<PracticePhase, string> = {
  cards: '生字卡片',
  chars: '文字练习',
  phrases: '词汇练习',
  poems: '古诗词',
  accumulation: '日积月累',
  blank: '填空题',
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

function lessonKeyForCharQuestion(
  q: CharPracticeQuestion,
  cards: CharCardItem[],
): string | null {
  if (q.kind === 'phrase-char') return q.item.lessonKey
  const card =
    cards.find((c) => c.charKey === q.charKey && c.lessonTitle === q.lessonTitle) ??
    cards.find((c) => c.charKey === q.charKey)
  return card?.lessonKey ?? null
}

function phaseForCharQuestion(q: CharPracticeQuestion): string {
  if (q.kind === 'phrase-char') return 'phrase'
  return q.kind
}

function enrichPlanForPhases(plan: PracticeSessionPlan) {
  return {
    charQuestions: plan.charQuestions.map((q) => ({
      lessonKey: lessonKeyForCharQuestion(q, plan.cards) ?? '',
      kind: q.kind,
      quizType: phaseForCharQuestion(q),
    })),
    phraseItems: plan.phraseItems,
    poems: plan.poems,
    accumulationItems: plan.accumulationItems,
    readingLessons: plan.readingLessons,
    pinyinWriteItems: plan.pinyinWriteItems,
  }
}

function lessonKeyForPoem(poem: PoemEntry, lessons: { lessonKey: string; unit: number; lesson: number; lessonKind: string }[]): string | null {
  const match = lessons.find((lesson) =>
    poemMatchesLessonMeta(poem, lesson.lessonKind, { unit: lesson.unit, lesson: lesson.lesson }),
  )
  return match?.lessonKey ?? null
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
  const { user } = useAuth()
  const { setIsImmersive } = useImmersive()
  const { awardStars, session: starSession } = useStarHud()
  const { lessons, lessonGroups, charByKey, getCharProfile, recordBatch, isCharDataReady, bookSlug } =
    useChineseContext()
  const { plans, appendLessonRuns, advanceAfterSession } = useChineseRoadmapPlan(user)

  const selUnits = useMemo(() => parseUnits(searchParams.get('units')), [searchParams])
  const selLessons = useMemo(() => parseLessons(searchParams.get('lessons')), [searchParams])
  const quizTypes = useMemo(
    () => parseQuizTypesParam(searchParams.get('types')),
    [searchParams],
  )
  const planId = searchParams.get('planId')
  const cardPreviewEnabled = searchParams.get('cardPreview') !== '0'
  const scopeKey = useMemo(
    () =>
      chinesePracticeScopeKey({
        bookSlug,
        units: [...selUnits].sort((a, b) => a - b).join(','),
        lessons: [...selLessons].join(','),
        types: searchParams.get('types') ?? '',
        cardPreview: cardPreviewEnabled ? '1' : '0',
      }),
    [bookSlug, selUnits, selLessons, searchParams, cardPreviewEnabled],
  )

  const filtered = useMemo(
    () =>
      isCharDataReady
        ? filterLessons(lessons, lessonGroups, selUnits, selLessons)
        : [],
    [isCharDataReady, lessons, lessonGroups, selUnits, selLessons],
  )

  const builtPlan = useMemo(
    () => buildPracticeSessionPlan(filtered, charByKey, quizTypes, lessons, bookSlug),
    [filtered, charByKey, quizTypes, lessons, bookSlug],
  )

  // Frozen plan for this run (preserves shuffle order across mid-exit restore).
  const [plan, setPlan] = useState<PracticeSessionPlan | null>(null)
  const hydrateDoneRef = useRef(false)
  const planSettleDoneRef = useRef(false)
  const sessionStartedAtRef = useRef<string>(new Date().toISOString())

  const [phase, setPhase] = useState<PracticePhase>(() =>
    cardPreviewEnabled ? 'cards' : 'chars',
  )
  const [cardIdx, setCardIdx] = useState(0)
  const [charQIdx, setCharQIdx] = useState(0)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [poemIdx, setPoemIdx] = useState(0)
  const [accIdx, setAccIdx] = useState(0)
  const [blankIdx, setBlankIdx] = useState(0)
  const [passageLessonIdx, setPassageLessonIdx] = useState(0)
  const [passageStep, setPassageStep] = useState<PassageStep>('read')
  const [passageBlankIdx, setPassageBlankIdx] = useState(0)
  const [pinyinWriteIdx, setPinyinWriteIdx] = useState(0)
  const [flipped, setFlipped] = useState(true)
  const [wrongFeedback, setWrongFeedback] = useState<{
    selected: string
    correct: string
  } | null>(null)
  const [strokeWrongMistakes, setStrokeWrongMistakes] = useState<number | null>(null)
  const [earnedMoons, setEarnedMoons] = useState(0)
  const [correctCounts, setCorrectCounts] = useState({ total: 0, correct: 0 })
  const [byLessonStats, setByLessonStats] = useState<Record<string, LessonTypeStats>>({})
  const [isStashing, setIsStashing] = useState(false)
  const [stashToast, setStashToast] = useState<string | null>(null)

  useEffect(() => {
    hydrateDoneRef.current = false
    planSettleDoneRef.current = false
    setPlan(null)
  }, [scopeKey, bookSlug])

  useEffect(() => {
    if (!isCharDataReady || hydrateDoneRef.current) return
    hydrateDoneRef.current = true

    void (async () => {
      const snap = await resolveChinesePracticeSnapshot(user?.id, bookSlug, scopeKey)
      if (snap && snap.phase !== 'done') {
        setPlan(snap.plan)
        setPhase(snap.phase)
        setCardIdx(snap.cardIdx)
        setCharQIdx(snap.charQIdx)
        setPhraseIdx(snap.phraseIdx)
        setPoemIdx(snap.poemIdx)
        setAccIdx(snap.accIdx)
        setBlankIdx(snap.blankIdx)
        setPassageLessonIdx(snap.passageLessonIdx)
        setPassageStep(snap.passageStep)
        setPassageBlankIdx(snap.passageBlankIdx)
        setPinyinWriteIdx(snap.pinyinWriteIdx)
        setEarnedMoons(snap.earnedMoons)
        setCorrectCounts(snap.correctCounts)
        setByLessonStats(snap.byLessonStats ?? {})
        sessionStartedAtRef.current = snap.sessionStartedAt ?? new Date().toISOString()
        return
      }
      setPlan(builtPlan)
      setPhase(cardPreviewEnabled ? 'cards' : 'chars')
      setCardIdx(0)
      setCharQIdx(0)
      setPhraseIdx(0)
      setPoemIdx(0)
      setAccIdx(0)
      setBlankIdx(0)
      setPassageLessonIdx(0)
      setPassageStep('read')
      setPassageBlankIdx(0)
      setPinyinWriteIdx(0)
      setEarnedMoons(0)
      setCorrectCounts({ total: 0, correct: 0 })
      setByLessonStats({})
      sessionStartedAtRef.current = new Date().toISOString()
      planSettleDoneRef.current = false
    })()
  }, [isCharDataReady, builtPlan, bookSlug, scopeKey, cardPreviewEnabled, user?.id])

  const getEnvelope = useCallback(() => {
    if (!plan || phase === 'done') return null
    return wrapChineseEnvelope({
      version: CHINESE_PRACTICE_SNAPSHOT_VERSION,
      date: todayStr(),
      bookSlug,
      scopeKey,
      phase,
      cardIdx,
      charQIdx,
      phraseIdx,
      poemIdx,
      accIdx,
      blankIdx,
      passageLessonIdx,
      passageStep,
      passageBlankIdx,
      pinyinWriteIdx,
      earnedMoons,
      correctCounts,
      plan,
      planId,
      byLessonStats,
      sessionStartedAt: sessionStartedAtRef.current,
    })
  }, [
    plan,
    phase,
    bookSlug,
    scopeKey,
    cardIdx,
    charQIdx,
    phraseIdx,
    poemIdx,
    accIdx,
    blankIdx,
    passageLessonIdx,
    passageStep,
    passageBlankIdx,
    pinyinWriteIdx,
    earnedMoons,
    correctCounts,
    planId,
    byLessonStats,
  ])

  const { flushCloudNow } = usePracticePendingLifecycle({
    enabled: !!plan && phase !== 'done',
    userId: user?.id,
    kind: CHINESE_PENDING_KIND,
    scopeKey,
    getEnvelope,
  })

  useEffect(() => {
    if (!stashToast) return
    const timer = window.setTimeout(() => setStashToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [stashToast])

  useEffect(() => {
    setIsImmersive(true)
    return () => setIsImmersive(false)
  }, [setIsImmersive])

  // Persist mid-session progress (same browser tab / refresh).
  useEffect(() => {
    if (!plan || phase === 'done') {
      if (phase === 'done') void clearChinesePendingEverywhere(user?.id, scopeKey)
      return
    }
    writeChinesePracticeSnapshot({
      version: CHINESE_PRACTICE_SNAPSHOT_VERSION,
      date: todayStr(),
      bookSlug,
      scopeKey,
      phase,
      cardIdx,
      charQIdx,
      phraseIdx,
      poemIdx,
      accIdx,
      blankIdx,
      passageLessonIdx,
      passageStep,
      passageBlankIdx,
      pinyinWriteIdx,
      earnedMoons,
      correctCounts,
      plan,
      planId,
      byLessonStats,
      sessionStartedAt: sessionStartedAtRef.current,
    })
  }, [
    plan,
    phase,
    bookSlug,
    scopeKey,
    cardIdx,
    charQIdx,
    phraseIdx,
    poemIdx,
    accIdx,
    blankIdx,
    passageLessonIdx,
    passageStep,
    passageBlankIdx,
    pinyinWriteIdx,
    earnedMoons,
    correctCounts,
    planId,
    byLessonStats,
    user?.id,
  ])

  const exitPractice = useCallback(() => {
    setIsImmersive(false)
    void flushCloudNow().then(() => {
      router.push('/chinese/chars')
    })
  }, [router, setIsImmersive, flushCloudNow])

  const stashAndExit = useCallback(async () => {
    setIsStashing(true)
    try {
      const synced = await flushCloudNow()
      setStashToast(
        synced ? '已暂存到云端，换设备也可继续' : '已暂存在本机，云端备份失败，可稍后在首页重试',
      )
      setIsImmersive(false)
      window.setTimeout(() => {
        router.push('/chinese/chars')
      }, 900)
    } finally {
      setIsStashing(false)
    }
  }, [flushCloudNow, router, setIsImmersive])

  const recordLessonAnswer = useCallback((lessonKey: string | null, phaseName: string, correct: boolean) => {
    if (!lessonKey) return
    setByLessonStats((prev) => {
      const lesson = prev[lessonKey] ?? {}
      const cur = lesson[phaseName] ?? { total: 0, correct: 0 }
      return {
        ...prev,
        [lessonKey]: {
          ...lesson,
          [phaseName]: {
            total: cur.total + 1,
            correct: cur.correct + (correct ? 1 : 0),
          },
        },
      }
    })
  }, [])

  const awardMoon = useCallback(
    async (amount: number, correct: boolean) => {
      setCorrectCounts((prev) => ({
        total: prev.total + 1,
        correct: prev.correct + (correct ? 1 : 0),
      }))
      if (correct && amount > 0) {
        setEarnedMoons((m) => m + amount)
        await awardStars('red', amount, { silent: true })
      }
    },
    [awardStars],
  )

  // Plan settle: write lesson runs + advance pointer once when reaching done.
  useEffect(() => {
    if (phase !== 'done' || !plan || !planId || planSettleDoneRef.current) return

    const roadmapPlan = plans.find((p) => p.id === planId)
    if (!roadmapPlan) return // wait until plans store is ready

    planSettleDoneRef.current = true

    const parsed = parseBookSlug(bookSlug)
    const bookLessons = parsed
      ? lessons.filter((l) => l.grade === parsed.grade && l.semester === parsed.semester)
      : lessons
    const orderedKeys = sortLessonsPedagogically(bookLessons)
      .filter((l) => l.lessonKind !== 'happy_reading')
      .map((l) => l.lessonKey)

    const phasePlan = enrichPlanForPhases(plan)
    const finishedAt = new Date().toISOString()
    const startedAt = sessionStartedAtRef.current
    const sessionLessons = filtered.map((f) => f.lesson)
    const completedInBatch: string[] = []

    const runs = sessionLessons.map((lesson) => {
      const { presentPhases, finishedPhases } = summarizeLessonPhases({
        lessonKey: lesson.lessonKey,
        lessonKind: lesson.lessonKind,
        plan: phasePlan,
        lessonMeta: { unit: lesson.unit, lesson: lesson.lesson },
        sessionReachedDone: true,
      })
      const completed = isLessonCompleteForPlan({
        lessonKind: lesson.lessonKind,
        planQuizTypes: roadmapPlan.quizTypes,
        presentPhases,
        finishedPhases,
      })
      if (completed) completedInBatch.push(lesson.lessonKey)

      const byType = byLessonStats[lesson.lessonKey] ?? {}
      let total = 0
      let correct = 0
      for (const row of Object.values(byType)) {
        total += row.total
        correct += row.correct
      }
      return {
        lessonKey: lesson.lessonKey,
        startedAt,
        finishedAt,
        completed,
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 10000) / 10000 : null,
        byType,
        quizTypes: presentPhases,
      }
    })

    const { nextCurrentLessonKey, bookFinished } = computeAdvanceAfterBatch({
      orderedKeys,
      completedLessonKeys: roadmapPlan.completedLessonKeys,
      newlyCompletedKeys: completedInBatch,
    })

    void (async () => {
      try {
        await appendLessonRuns(planId, runs)
        await advanceAfterSession(planId, {
          completedLessonKeysInBatch: completedInBatch,
          nextCurrentLessonKey,
          bookFinished,
        })
      } catch (err) {
        console.error('[chinese_roadmap_plan] settle failed', err)
        planSettleDoneRef.current = false
      }
    })()
  }, [
    phase,
    plan,
    planId,
    plans,
    bookSlug,
    lessons,
    filtered,
    byLessonStats,
    appendLessonRuns,
    advanceAfterSession,
  ])

  const goNextPhase = useCallback(
    (from: PracticePhase) => {
      if (!plan) return
      const order: PracticePhase[] = [
        'cards',
        'chars',
        'phrases',
        'poems',
        'accumulation',
        'passage',
        'blank',
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
        if (next === 'passage' && plan.readingLessons.length === 0) continue
        if (next === 'blank' && plan.blankItems.length === 0) continue
        if (next === 'pinyin-write' && plan.pinyinWriteItems.length === 0) continue
        setPhase(next)
        return
      }
      setPhase('done')
    },
    [plan, cardPreviewEnabled],
  )

  useEffect(() => {
    if (!isCharDataReady || !plan) return
    if (phase === 'cards' && (!cardPreviewEnabled || plan.cards.length === 0)) {
      goNextPhase('cards')
      return
    }
    if (!cardPreviewEnabled && phase === 'chars' && plan.charQuestions.length === 0) {
      goNextPhase('chars')
    }
  }, [
    isCharDataReady,
    plan,
    phase,
    goNextPhase,
    cardPreviewEnabled,
  ])

  const currentCard = plan?.cards[cardIdx]
  const currentCharQ = plan?.charQuestions[charQIdx] as CharPracticeQuestion | undefined
  const currentPhrase = plan?.phraseItems[phraseIdx]
  const currentPoem = plan?.poems[poemIdx]
  const currentAcc = plan?.accumulationItems[accIdx]
  const currentBlank = plan?.blankItems[blankIdx]
  const currentReading = plan?.readingLessons[passageLessonIdx]
  const currentPassageBlank = currentReading?.blankItems[passageBlankIdx]
  const currentPinyinWrite = plan?.pinyinWriteItems[pinyinWriteIdx]

  const phraseOptions = useMemo(() => {
    if (!currentPhrase) return []
    const pool = filtered.flatMap((f) => [...f.group.recognize, ...f.group.write])
    const seed = currentPhrase.id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 11) >>> 0
    return buildPhraseOptions(currentPhrase, [...new Set(pool)], seed)
  }, [currentPhrase, filtered])

  const blankOptions = currentBlank?.options ?? []
  const passageBlankOptions = currentPassageBlank?.options ?? []

  const currentReadingMeta = useMemo(() => {
    if (!currentReading) return null
    const lessonRow = findLessonRow(lessons, currentReading.lessonKey, bookSlug)
    const group = getLessonGroup(lessonGroups, currentReading.lessonKey, bookSlug)
    const passage = getLessonPassage(currentReading.lessonKey, bookSlug)
    const unitLessons = lessonRow
      ? lessons.filter((l) => l.unit === lessonRow.unit)
      : []
    const display = lessonRow ? getLessonDisplayInfo(lessonRow, unitLessons) : null
    return {
      lessonRow,
      group,
      paragraphs: passage?.paragraphs ?? [],
      bookLessonNo: display?.bookLessonNo ?? null,
    }
  }, [bookSlug, currentReading, lessonGroups, lessons])

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
    if (!plan) return
    clearQuestionFeedback()
    if (charQIdx + 1 >= plan.charQuestions.length) {
      goNextPhase('chars')
      setCharQIdx(0)
    } else {
      setCharQIdx((i) => i + 1)
    }
  }, [charQIdx, clearQuestionFeedback, goNextPhase, plan])

  const advancePhraseQuestion = useCallback(() => {
    if (!plan) return
    clearQuestionFeedback()
    if (phraseIdx + 1 >= plan.phraseItems.length) {
      goNextPhase('phrases')
      setPhraseIdx(0)
    } else {
      setPhraseIdx((i) => i + 1)
    }
  }, [clearQuestionFeedback, goNextPhase, phraseIdx, plan])

  const advanceBlankQuestion = useCallback(() => {
    if (!plan) return
    clearQuestionFeedback()
    if (blankIdx + 1 >= plan.blankItems.length) {
      goNextPhase('blank')
      setBlankIdx(0)
    } else {
      setBlankIdx((i) => i + 1)
    }
  }, [blankIdx, clearQuestionFeedback, goNextPhase, plan])

  const finishReadingLesson = useCallback(() => {
    if (!plan) return
    clearQuestionFeedback()
    if (passageLessonIdx + 1 >= plan.readingLessons.length) {
      goNextPhase('passage')
      setPassageLessonIdx(0)
      setPassageStep('read')
      setPassageBlankIdx(0)
    } else {
      setPassageLessonIdx((i) => i + 1)
      setPassageStep('read')
      setPassageBlankIdx(0)
    }
  }, [clearQuestionFeedback, goNextPhase, passageLessonIdx, plan])

  const onFinishedRead = useCallback(() => {
    if (!currentReading) return
    if (currentReading.blankItems.length === 0) {
      finishReadingLesson()
      return
    }
    setPassageStep('blank')
    setPassageBlankIdx(0)
  }, [currentReading, finishReadingLesson])

  const advancePassageBlankQuestion = useCallback(() => {
    if (!plan || !currentReading) return
    clearQuestionFeedback()
    if (passageBlankIdx + 1 >= currentReading.blankItems.length) {
      finishReadingLesson()
    } else {
      setPassageBlankIdx((i) => i + 1)
    }
  }, [clearQuestionFeedback, currentReading, finishReadingLesson, passageBlankIdx, plan])

  const advanceAccQuestion = useCallback(() => {
    if (!plan) return
    clearQuestionFeedback()
    if (accIdx + 1 >= plan.accumulationItems.length) {
      goNextPhase('accumulation')
      setAccIdx(0)
    } else {
      setAccIdx((i) => i + 1)
    }
  }, [accIdx, clearQuestionFeedback, goNextPhase, plan])

  const handleChoiceAnswer = useCallback(
    async (
      correct: boolean,
      reward: number,
      advance: () => void,
      wrong?: { selected: string; correct: string },
      track?: { lessonKey: string | null; phaseName: string },
    ) => {
      if (track) recordLessonAnswer(track.lessonKey, track.phaseName, correct)
      await awardMoon(reward, correct)
      if (correct) {
        advance()
      } else if (wrong) {
        setWrongFeedback(wrong)
      }
    },
    [awardMoon, recordLessonAnswer],
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
      if (plan) {
        recordLessonAnswer(
          lessonKeyForCharQuestion(q, plan.cards),
          phaseForCharQuestion(q),
          correct,
        )
      }
      await awardMoon(MOON_REWARDS.char, correct)
      if (correct) {
        advanceCharQuestion()
      } else if (wrong) {
        setWrongFeedback(wrong)
      }
    },
    [advanceCharQuestion, awardMoon, plan, recordBatch, recordLessonAnswer],
  )

  if (!isCharDataReady || !plan) {
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
        {stashToast && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 shadow-md">
            {stashToast}
          </div>
        )}

        <header className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={exitPractice}
            className="cursor-pointer rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-sm font-bold text-amber-900/60 hover:border-amber-400"
          >
            ← 退出
          </button>
          {phase !== 'done' && (
            <button
              type="button"
              onClick={() => void stashAndExit()}
              disabled={isStashing}
              className="cursor-pointer rounded-full border border-amber-300/80 bg-amber-50/90 px-3 py-1 text-sm font-bold text-amber-800 hover:border-amber-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isStashing ? '暂存中…' : '💾 暂存'}
            </button>
          )}
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
                          recordLessonAnswer(
                            lessonKeyForCharQuestion(currentCharQ, plan.cards),
                            'stroke',
                            false,
                          )
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
                        { lessonKey: currentPhrase.lessonKey, phaseName: 'phrase' },
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
                const correct = score >= 60
                recordLessonAnswer(
                  lessonKeyForPoem(
                    currentPoem,
                    filtered.map((f) => f.lesson),
                  ),
                  'poems',
                  correct,
                )
                await awardMoon(MOON_REWARDS.poem, correct)
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
                      const gardenKey =
                        filtered.find(
                          (f) =>
                            f.lesson.unit === currentAcc.unit &&
                            f.lesson.lessonKind === 'garden',
                        )?.lesson.lessonKey ?? null
                      void handleChoiceAnswer(
                        opt === currentAcc.answer,
                        MOON_REWARDS.accumulation,
                        advanceAccQuestion,
                        opt === currentAcc.answer
                          ? undefined
                          : { selected: opt, correct: currentAcc.answer },
                        { lessonKey: gardenKey, phaseName: 'accumulation' },
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

        {phase === 'passage' && currentReading && passageStep === 'read' && currentReadingMeta && (
          <div className="flex flex-1 flex-col">
            <p className="mb-3 text-center text-xs font-semibold text-amber-900/45">
              阅读 {passageLessonIdx + 1} / {plan.readingLessons.length}
            </p>
            <LessonPassageReader
              lessonKey={currentReading.lessonKey}
              bookSlug={bookSlug}
              lessonTitle={currentReading.lessonTitle}
              unit={currentReadingMeta.lessonRow?.unit ?? null}
              bookLessonNo={currentReadingMeta.bookLessonNo}
              paragraphs={currentReadingMeta.paragraphs}
              recognize={currentReadingMeta.group?.recognize ?? []}
              write={currentReadingMeta.group?.write ?? []}
              recallPhrases={currentReadingMeta.lessonRow?.recallPhrases ?? []}
              footer={
                <div className="mt-6 flex flex-col gap-4">
                  <PassageRecorder
                    bookSlug={bookSlug}
                    lessonKey={currentReading.lessonKey}
                    lessonTitle={currentReading.lessonTitle}
                  />
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={onFinishedRead}
                      className="cn-start-btn rounded-xl border-0 px-6 py-2.5 text-sm font-bold text-white"
                    >
                      {currentReading.blankItems.length > 0 ? '读完了，开始回想' : '读完了'}
                    </button>
                  </div>
                </div>
              }
            />
          </div>
        )}

        {phase === 'passage' && currentPassageBlank && passageStep === 'blank' && currentReading && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              回想 {passageBlankIdx + 1} / {currentReading.blankItems.length}
              {' · '}
              {currentReading.lessonTitle}
            </p>
            <p className="text-center text-sm font-semibold text-amber-800/70">
              {currentPassageBlank.blankKind === 'word'
                ? '选出句子里彩色小空格里应该填的词语'
                : '选出句子里彩色小空格里应该填的字'}
            </p>
            <div className="rounded-2xl border border-amber-200/70 bg-white/85 p-4 shadow-sm">
              <QuizBlankSentence display={currentPassageBlank.prompt} size="md" align="start" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {passageBlankOptions.map((opt) => {
                const locked = wrongFeedback !== null
                const isCorrect = opt === currentPassageBlank.answer
                const isChosen = wrongFeedback?.selected === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      void handleChoiceAnswer(
                        opt === currentPassageBlank.answer,
                        MOON_REWARDS.blank,
                        advancePassageBlankQuestion,
                        opt === currentPassageBlank.answer
                          ? undefined
                          : { selected: opt, correct: currentPassageBlank.answer },
                        { lessonKey: currentReading.lessonKey, phaseName: 'passage' },
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
                onNext={advancePassageBlankQuestion}
              />
            )}
          </div>
        )}

        {phase === 'blank' && currentBlank && (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-center text-xs font-semibold text-amber-900/45">
              填空题 {blankIdx + 1} / {plan.blankItems.length}
            </p>
            <p className="text-center text-sm font-semibold text-amber-800/70">
              {currentBlank.blankKind === 'word'
                ? '选出句子里彩色小空格里应该填的词语'
                : '选出句子里彩色小空格里应该填的字'}
              {' · '}
              {currentBlank.lessonTitle}
            </p>
            <div className="rounded-2xl border border-amber-200/70 bg-white/85 p-4 shadow-sm">
              <QuizBlankSentence display={currentBlank.prompt} size="md" align="start" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {blankOptions.map((opt) => {
                const locked = wrongFeedback !== null
                const isCorrect = opt === currentBlank.answer
                const isChosen = wrongFeedback?.selected === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      void handleChoiceAnswer(
                        opt === currentBlank.answer,
                        MOON_REWARDS.blank,
                        advanceBlankQuestion,
                        opt === currentBlank.answer
                          ? undefined
                          : { selected: opt, correct: currentBlank.answer },
                        { lessonKey: currentBlank.lessonKey, phaseName: 'passage' },
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
                onNext={advanceBlankQuestion}
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
                recordLessonAnswer(currentPinyinWrite.lessonKey, 'pinyin-write', correct)
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
