'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase, type WordEntry } from '@rosie/core'
import { fetchStageVocab } from '../hooks/useWordData'
import type {
  PetExerciseSet,
  PetReviewProgress,
  PetSession,
  PetSessionAction,
  PetStartSessionInput,
  PetWordContent,
} from './types'

type SessionRow = Omit<PetSession,
  'feedbackMode' | 'setId' | 'setRevision' | 'wordPool' | 'reviewWordIds' |
  'timerEnabled' | 'itemIndex' | 'startedAt' | 'completedAt' | 'updatedAt'
> & {
  feedback_mode: PetSession['feedbackMode']
  set_id: string | null
  set_revision: string | null
  word_pool: string[]
  review_word_ids: string[]
  timer_enabled: boolean
  item_index: number
  started_at: string
  completed_at: string | null
  updated_at: string
}

type ReviewRow = {
  word_entry_id: string
  interval_index: number
  due_on: string
  last_reviewed_on: string | null
  updated_at: string
}

type ContentRow = {
  word_entry_id: string
  revision: string
  content: Omit<PetWordContent, 'wordEntryId' | 'revision'>
}

type ExerciseSetRow = Omit<PetExerciseSet, 'wordPool'> & { word_pool: string[] }

type CommandResult = {
  session?: SessionRow
  today?: string
  reviewProgress?: ReviewRow[]
}

type PetLearningData = {
  words: WordEntry[]
  contentByWordId: Record<string, PetWordContent>
  exerciseSets: PetExerciseSet[]
  reviewProgress: PetReviewProgress[]
  activeSession: PetSession | null
  recentSessions: PetSession[]
  today: string
}

const EMPTY: PetLearningData = {
  words: [],
  contentByWordId: {},
  exerciseSets: [],
  reviewProgress: [],
  activeSession: null,
  recentSessions: [],
  today: '',
}

const PAGE_SIZE = 100
const SESSION_FIELDS = [
  'id', 'version', 'status', 'mode', 'track', 'feedback_mode', 'source', 'set_id', 'set_revision',
  'items', 'passage', 'word_pool', 'review_word_ids', 'timer_enabled', 'answers', 'item_index',
  'started_at', 'completed_at', 'updated_at',
].join(',')

function sessionFromRow(row: SessionRow): PetSession {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    mode: row.mode,
    track: row.track,
    feedbackMode: row.feedback_mode,
    source: row.source,
    setId: row.set_id,
    setRevision: row.set_revision,
    items: row.items,
    passage: row.passage,
    wordPool: row.word_pool,
    reviewWordIds: row.review_word_ids,
    timerEnabled: row.timer_enabled,
    answers: row.answers,
    itemIndex: row.item_index,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

function reviewFromRow(row: ReviewRow): PetReviewProgress {
  return {
    wordEntryId: row.word_entry_id,
    intervalIndex: row.interval_index,
    dueOn: row.due_on,
    lastReviewedOn: row.last_reviewed_on,
    updatedAt: row.updated_at,
  }
}

async function fetchPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await read(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) return rows
  }
}

async function command(
  userId: string,
  name: 'start' | 'save' | 'complete' | 'abandon' | 'sync_review',
  input: Record<string, unknown> = {},
): Promise<CommandResult> {
  const { data, error } = await supabase.rpc('pet_learning_command', {
    p_command: name,
    p_input: { ...input, userId },
  })
  if (error) {
    const messages: Record<string, string> = {
      '23505': '已有一组练习进行中，请重新加载后继续。',
      '40001': '练习已在其他设备更新，请重新加载后继续。',
      '42501': '无法访问本组练习，请确认当前登录账号。',
      'PET review words must be due': '复习列表已更新，请重新加载后再开始。',
      'PET exercise set is unavailable or has changed': '练习内容已更新，请重新加载后再开始。',
    }
    throw new Error(messages[error.message] ?? messages[error.code] ?? error.message)
  }
  return data as CommandResult
}

const petStore = createUserSessionStore<PetLearningData>('pet_learning', {
  empty: EMPTY,
  async fetch(userId) {
    const [words, contentRows, setRows, progress, active, completed] = await Promise.all([
      fetchStageVocab(userId, 'PET'),
      fetchPages<ContentRow>((from, to) => supabase
        .from('pet_word_content').select('word_entry_id,revision,content')
        .eq('published', true).order('word_entry_id').range(from, to)
        .returns<ContentRow[]>()),
      fetchPages<ExerciseSetRow>((from, to) => supabase
        .from('pet_exercise_sets').select('id,revision,kind,title,topic,passage,word_pool,items')
        .eq('published', true).order('id').range(from, to)
        .returns<ExerciseSetRow[]>()),
      command(userId, 'sync_review'),
      supabase.from('pet_practice_sessions').select(SESSION_FIELDS)
        .eq('user_id', userId).eq('status', 'active').maybeSingle<SessionRow>(),
      fetchPages<SessionRow>((from, to) => supabase
        .from('pet_practice_sessions').select(SESSION_FIELDS)
        .eq('user_id', userId).eq('status', 'completed')
        .order('completed_at', { ascending: false }).order('id').range(from, to)
        .returns<SessionRow[]>()),
    ])
    if (active.error) throw active.error
    return {
      words,
      contentByWordId: Object.fromEntries(contentRows.map((row) => [
        row.word_entry_id,
        { ...row.content, wordEntryId: row.word_entry_id, revision: row.revision, priorities: row.content.priorities ?? [] },
      ])),
      exerciseSets: setRows.map(({ word_pool, ...row }) => ({ ...row, wordPool: word_pool })),
      reviewProgress: (progress.reviewProgress ?? []).map(reviewFromRow),
      activeSession: active.data ? sessionFromRow(active.data) : null,
      recentSessions: completed.map(sessionFromRow),
      today: progress.today ?? '',
    }
  },
})

export function usePetLearning(user: User | null) {
  const userId = user?.id
  const { data, isLoading, error } = petStore.useSessionData(user)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      await petStore.refreshInBackground(userId)
    } catch (cause) {
      setRefreshError(cause)
      throw cause
    } finally {
      setRefreshing(false)
    }
  }, [userId])

  const mutateSession = useCallback(async (
    name: 'start' | 'save' | 'complete' | 'abandon',
    input: Record<string, unknown>,
  ): Promise<PetSession> => {
    if (!userId) throw new Error('请先登录')
    const result = await command(userId, name, input)
    if (!result.session) throw new Error('练习保存失败，请重试')
    const session = sessionFromRow(result.session)
    const reviewRows = result.reviewProgress?.map(reviewFromRow) ?? []
    petStore.patchSessionData(userId, (previous) => {
      const progress = new Map(previous.reviewProgress.map((row) => [row.wordEntryId, row]))
      for (const row of reviewRows) {
        const current = progress.get(row.wordEntryId)
        if (!current || row.updatedAt >= current.updatedAt) progress.set(row.wordEntryId, row)
      }
      const active = previous.activeSession
      let activeSession = active
      if (session.status === 'active') {
        if (!active || (active.id === session.id && active.version <= session.version) ||
          (active.id !== session.id && active.startedAt < session.startedAt)) {
          activeSession = session
        }
      } else if (active?.id === session.id) {
        activeSession = null
      }
      const hasCompleted = previous.recentSessions.some((previousSession) => previousSession.id === session.id)
      const recentSessions = session.status === 'completed' && !hasCompleted
        ? [...previous.recentSessions, session].sort((left, right) =>
          (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))
        : previous.recentSessions
      return {
        ...previous,
        activeSession,
        recentSessions,
        reviewProgress: [...progress.values()],
        today: result.today ?? previous.today,
      }
    })
    return session
  }, [userId])

  const startSession = useCallback((input: PetStartSessionInput) => {
    const { requestId, ...session } = input
    return mutateSession('start', { ...session, id: requestId ?? crypto.randomUUID() })
  }, [mutateSession])

  const saveSession = useCallback((session: PetSession, action: PetSessionAction) =>
    mutateSession('save', {
      id: session.id,
      version: session.version,
      action: { ...action, requestId: action.requestId ?? crypto.randomUUID() },
    }), [mutateSession])

  const completeSession = useCallback((session: PetSession) =>
    mutateSession('complete', { id: session.id, version: session.version }), [mutateSession])

  const abandonSession = useCallback((session: PetSession) =>
    mutateSession('abandon', { id: session.id, version: session.version }), [mutateSession])

  const enrollReview = useCallback(async (wordEntryIds?: string[]) => {
    if (!userId || wordEntryIds?.length === 0) return
    const result = await command(userId, 'sync_review', { wordEntryIds })
    if (!petStore.getSessionData(userId)) return
    petStore.patchSessionData(userId, (previous) => {
      const progress = new Map(previous.reviewProgress.map((row) => [row.wordEntryId, row]))
      return {
        ...previous,
        today: result.today ?? previous.today,
        reviewProgress: (result.reviewProgress ?? []).map((row) => {
          const current = progress.get(row.word_entry_id)
          return current && current.updatedAt > row.updated_at ? current : reviewFromRow(row)
        }),
      }
    })
  }, [userId])

  useEffect(() => {
    if (!userId || !data.today) return
    const checkDate = () => {
      const now = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
      if (now !== data.today) {
        void enrollReview().then(() => setRefreshError(null), setRefreshError)
      }
    }
    checkDate()
    window.addEventListener('focus', checkDate)
    const timer = window.setInterval(checkDate, 60_000)
    return () => {
      window.removeEventListener('focus', checkDate)
      window.clearInterval(timer)
    }
  }, [userId, data.today, enrollReview])

  return {
    ...data,
    ready: petStore.getSnapshot(userId).status === 'ready',
    loading: isLoading || refreshing,
    error: error ?? refreshError,
    refresh,
    startSession,
    saveSession,
    completeSession,
    abandonSession,
    enrollReview,
  }
}
