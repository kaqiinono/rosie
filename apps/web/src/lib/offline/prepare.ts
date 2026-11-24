'use client'

import { calcSettingsStore } from '@rosie/calc'
import { projectMediaUrl, supabase, type MathPlanProblem, type WeeklyPlan } from '@rosie/core'
import { buildQuizOptions, getDailySessionWords, interleaveOrderedQuizSlots, wordEntriesStore, wordKey } from '@rosie/english'
import { blankWordInSentence, findPassage, findSentenceForWord } from '@rosie/english/utils/reading-data'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { MATH_IMAGES_BUCKET } from '@rosie/math-kit/constants'
import { isPlanProblemDone } from '@rosie/math-kit/utils/math-helpers'
import type { Snapshot } from '@/lib/time-tree/types'
import type { TodayPlanCardModel } from '@/components/today/TodayPlanOverview'
import type { OfflinePack, OfflineMathQuestion, OfflineEnglishRound, OfflineTreeTask } from './store'

const MAX_MEDIA_BYTES = 24 * 1024 * 1024
const MAX_QUESTION_IMAGE_BYTES = 4 * 1024 * 1024

async function readImage(url: string, token: string): Promise<Blob> {
  const target = new URL(url, location.origin)
  if (target.origin !== location.origin) throw new Error('题图需要联网查看。')
  const response = await fetch(target, {
    cache: 'no-store',
    headers: target.pathname.startsWith('/api/') ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('题图下载失败。')
  }
  const blob = await response.blob()
  if (blob.size > MAX_QUESTION_IMAGE_BYTES) throw new Error('题图超出离线大小。')
  return blob
}

async function prepareMath(input: PrepareInput, token: string): Promise<OfflinePack['math']> {
  if (!input.mathPlanId || !input.math.length) return undefined
  const assigned = input.math.filter((problem) => !isPlanProblemDone(problem, input.day, input.mathDone))
  const ids = [...new Set(assigned.map((item) => item.problemId))]
  const { data, error } = ids.length
    ? await supabase.from('math_problem_images')
      .select('problem_id,image_kind,storage_path').in('problem_id', ids)
      .in('image_kind', ['figure', 'analysis'])
    : { data: [], error: null }
  if (error) throw error

  const questions: OfflineMathQuestion[] = []
  const downloaded = new Map<string, Blob>()
  let bytes = 0
  async function image(url: string) {
    const existing = downloaded.get(url)
    if (existing) return existing
    const blob = await readImage(url, token)
    if (bytes + blob.size > MAX_MEDIA_BYTES) throw new Error('已达到题图下载上限。')
    downloaded.set(url, blob)
    bytes += blob.size
    return blob
  }

  for (const assignment of assigned) {
    const problem = SEA_POOL.find((entry) => entry.problem.id === assignment.problemId)?.problem
    if (!problem || problem.checkAnswer || problem.verticalPuzzle || !Number.isFinite(problem.finalAns)
      || (problem.figureNode && !data?.some((row) => row.problem_id === problem.id && row.image_kind === 'figure'))) continue
    const figurePaths = (data ?? []).filter((row) => row.problem_id === problem.id && row.image_kind === 'figure')
    const solutionPath = (data ?? []).find((row) => row.problem_id === problem.id && row.image_kind === 'analysis')
    try {
      const embeddedFigures = Array.from(new DOMParser().parseFromString(problem.text, 'text/html').images,
        (element) => element.getAttribute('src') ?? '').filter(Boolean)
      const figureUrls = [...new Set([
        ...figurePaths.map((row) => projectMediaUrl(MATH_IMAGES_BUCKET, row.storage_path)),
        ...embeddedFigures,
      ])]
      const images: Blob[] = []
      for (const url of figureUrls) images.push(await image(url))
      const solutionUrl = solutionPath ? projectMediaUrl(MATH_IMAGES_BUCKET, solutionPath.storage_path) : problem.analysisImg
      const solutionImage = solutionUrl ? await image(solutionUrl).catch(() => undefined) : undefined
      questions.push({
        assignment,
        id: problem.id,
        section: assignment.section,
        title: problem.title,
        text: problem.text,
        questions: [problem, ...(problem.additionalQuestions ?? [])]
          .map((item) => ({ label: [item.finalQ, item.finalUnit].filter(Boolean).join(' · '), answer: item.finalAns })),
        images,
        analysis: problem.analysis,
        solutionImage,
      })
    } catch {
      // Keep successfully downloaded exercises available when an individual figure fails.
    }
  }
  return { planId: input.mathPlanId, questions, unavailable: assigned.length - questions.length }
}

async function prepareEnglish(owner: string, input: PrepareInput): Promise<OfflineEnglishRound | undefined> {
  const plan = input.englishPlan
  if (!plan?.id || plan.progress[input.day]?.quizDone || input.cards.find((card) => card.key === 'english')?.href?.includes('/adaptive/')) return
  const dayIndex = plan.days.findIndex((day) => day.date === input.day)
  if (dayIndex < 0) return
  await wordEntriesStore.ensureLoaded(owner)
  const library = wordEntriesStore.getSnapshot(owner)
  if (library.status !== 'ready') throw library.error ?? new Error('英语词条未下载。')
  const words = getDailySessionWords(plan, library.data, {}, dayIndex)
  if (!words.length) return
  const preparedKeys = new Set(words.map(({ entry }) => wordKey(entry)))
  if (plan.days.slice(0, dayIndex + 1).some((day) => day.newWordKeys.some((key) => !preparedKeys.has(key)))) {
    throw new Error('英语计划有词条尚未下载。')
  }
  const groups: OfflineEnglishRound['questions'][] = []
  for (const [index, { entry, kind }] of words.entries()) {
    const meaning = (entry.chineseDef || entry.explanation).trim()
    if (!meaning) return
    const options = buildQuizOptions(entry, library.data, index + dayIndex)
    const spellings = options.map((word) => word.word)
    const meanings = [...new Set(options.map((word) => (word.chineseDef || word.explanation).trim()))].filter(Boolean)
    const questions: OfflineEnglishRound['questions'] = []
    if (spellings.length < 2 || (kind === 'preview' && meanings.length < 2)) return
    questions.push({ id: crypto.randomUUID(), type: 'A', prompt: meaning, word: entry, answer: entry.word, choices: spellings })
    if (kind === 'preview') {
      questions.push({ id: crypto.randomUUID(), type: 'B', prompt: entry.word, word: entry, answer: meaning, choices: meanings })
    } else {
      questions.push({ id: crypto.randomUUID(), type: 'C', prompt: meaning, word: entry, answer: entry.word })
      const passage = findPassage(entry.stage, entry.unit, entry.lesson)
      const sentence = passage && findSentenceForWord(passage, entry)
      if (sentence) questions.push({ id: crypto.randomUUID(), type: 'D',
        prompt: blankWordInSentence(sentence.sentence, entry), word: entry, answer: entry.word, choices: spellings })
    }
    groups.push(questions)
  }
  const questions = interleaveOrderedQuizSlots(groups, dayIndex + 1)
  if (questions.length > 500) throw new Error('当天英语题量超出离线范围。')
  return { id: crypto.randomUUID(), planId: plan.id, day: input.day, name: '英语周计划', questions }
}

async function prepareTree(token: string, day: string): Promise<OfflinePack['tree']> {
  const response = await fetch('/api/time-tree?offline=1', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('生命树作业未下载。')
  const scene = await response.json() as Snapshot & { offlineProofs?: Record<string, string> }
  if (scene.tree.today !== day) throw new Error('生命树作业尚未更新到今天。')
  const tasks: OfflineTreeTask[] = scene.tree.steps.flatMap((step) => {
    if (step.planned !== scene.tree.today || step.skipped) return []
    const proof = scene.offlineProofs?.[step.id]
    return [{
      id: step.id, name: step.name, notes: [step.planNote, step.notes].filter(Boolean).join('\n'),
      minutes: step.minutes, planned: step.planned, start: step.start,
      completed: Boolean(step.end), canComplete: Boolean(proof), proof,
    }]
  })
  return { revision: scene.revision, tasks }
}

export type PrepareInput = {
  day: string
  cards: TodayPlanCardModel[]
  englishPlan: WeeklyPlan | null
  mathPlanId?: string
  math: MathPlanProblem[]
  mathDone: string[]
}

export async function prepareOfflinePack(owner: string, input: PrepareInput, prior?: OfflinePack): Promise<OfflinePack> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || session?.user.id !== owner) throw new Error('登录后才能下载学习内容。')
  const { data: { user }, error: authError } = await supabase.auth.getUser(session.access_token)
  if (authError || user?.id !== owner) throw new Error('登录服务暂时不可用，保留已下载的内容。')
  const sameDay = prior?.day === input.day ? prior : undefined
  const [calc, english, math, tree] = await Promise.allSettled([
    calcSettingsStore.refreshInBackground(owner).then(() => calcSettingsStore.getSessionData(owner)),
    prepareEnglish(owner, input),
    prepareMath(input, session.access_token),
    prepareTree(session.access_token, input.day),
  ])
  return {
    day: input.day,
    savedAt: new Date().toISOString(),
    cards: input.cards.map((card) => ({ ...card, href: null })),
    calc: calc.status === 'fulfilled' ? calc.value : prior?.calc,
    english: english.status === 'fulfilled' ? english.value : sameDay?.english,
    math: math.status === 'fulfilled' ? math.value : sameDay?.math,
    tree: tree.status === 'fulfilled' ? tree.value : sameDay?.tree,
  }
}
