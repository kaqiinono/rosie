import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * In-memory mutex replacing the default Web Locks-based `lock` — avoids the
 * "Lock broken by steal" AbortErrors Web Locks throws when many hooks issue
 * concurrent Supabase calls on one page, WITHOUT dropping serialization.
 *
 * supabase-js calls this to guard token refresh. A no-op passthrough (the
 * previous implementation) let every concurrent caller trigger its own
 * `token?grant_type=refresh_token` at once; since GoTrue refresh tokens are
 * single-use/rotating, only the first succeeds and the rest fail/retry —
 * a thundering herd that trips GoTrue's rate limit ("Request rate limit
 * reached") whenever a page mounts many data hooks at once (e.g. entering
 * math practice from the homepage card).
 */
const lockChains = new Map<string, Promise<unknown>>()

async function serialLock<R>(name: string, fn: () => Promise<R>): Promise<R> {
  const prior = lockChains.get(name) ?? Promise.resolve()
  // Chain onto prior regardless of its outcome so one failed refresh can't wedge the queue.
  const run = prior.then(fn, fn)
  lockChains.set(
    name,
    run.catch(() => undefined),
  )
  return run
}

const supabaseAuthOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Password-recovery links return credentials in the URL. Supabase must
    // consume them before the reset page can receive PASSWORD_RECOVERY.
    detectSessionInUrl: true,
    lock: async <R>(name: string, _acquireTimeout: number, fn: () => Promise<R>) =>
      serialLock(name, fn),
  },
} as const

let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, supabaseAuthOptions)
  }
  return supabaseClient
}

/** Lazy singleton — avoids createClient at import time so `next build` succeeds without env vars. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export type Database = {
  public: {
    Tables: {
      math_solved: {
        Row: {
          id: string
          user_id: string
          problem_id: string
          solved_at: string
          solve_count: number
        }
        Insert: { user_id: string; problem_id: string; solved_at?: string; solve_count?: number }
      }
      math_wrong: {
        Row: {
          user_id: string
          problem_id: string
          added_at: string
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          user_id: string
          problem_id: string
          added_at?: string
          resolved?: boolean
          resolved_at?: string | null
        }
      }
      math_skipped: {
        Row: {
          user_id: string
          problem_id: string
          reason: string
          note: string | null
          added_at: string
        }
        Insert: {
          user_id: string
          problem_id: string
          reason?: string
          note?: string | null
          added_at?: string
        }
      }
      math_quiz_batches: {
        Row: {
          id: string
          user_id: string
          title_base: string
          config: unknown
          volume_count: number
          created_at: string
        }
        Insert: {
          user_id: string
          title_base: string
          config?: unknown
          volume_count?: number
        }
      }
      math_quiz_papers: {
        Row: {
          id: string
          user_id: string
          title: string
          problems: unknown
          score: number | null
          total_score: number
          answers: unknown | null
          completed_at: string | null
          created_at: string
          batch_id: string | null
          batch_index: number | null
        }
        Insert: {
          user_id: string
          title: string
          problems: unknown
          score?: number | null
          total_score: number
          answers?: unknown | null
          completed_at?: string | null
          batch_id?: string | null
          batch_index?: number | null
        }
      }
      word_entries: {
        Row: {
          id: string
          user_id: string
          unit: string
          lesson: string
          word: string
          explanation: string
          ipa: string | null
          example: string | null
          phonics: string | null
        }
        Insert: {
          user_id: string
          unit: string
          lesson: string
          word: string
          explanation: string
          ipa?: string | null
          example?: string | null
          phonics?: string | null
        }
      }
      daily_progress: {
        Row: {
          id: string
          user_id: string
          day_number: number
          quiz_done: boolean
          last_score: number | null
          last_date: string | null
        }
        Insert: {
          user_id: string
          day_number: number
          quiz_done?: boolean
          last_score?: number | null
          last_date?: string | null
        }
      }
      word_mastery: {
        Row: {
          id: string
          user_id: string
          word_key: string
          correct: number
          incorrect: number
          last_seen: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          word_key: string
          correct?: number
          incorrect?: number
          last_seen?: string | null
          updated_at?: string
        }
      }
      english_wrong: {
        Row: {
          user_id: string
          word_key: string
          added_at: string
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          user_id: string
          word_key: string
          added_at?: string
          resolved?: boolean
          resolved_at?: string | null
        }
      }
      weekly_plans: {
        Row: {
          id: string
          user_id: string
          week_start: string
          unit: string
          lesson: string
          plan_data: unknown
          progress_data: unknown
          updated_at: string
        }
        Insert: {
          user_id: string
          week_start: string
          unit: string
          lesson: string
          plan_data: unknown
          progress_data?: unknown
          updated_at?: string
        }
      }
      adaptive_word_plans: {
        Row: {
          id: string
          user_id: string
          title: string
          scope: unknown
          new_words_per_day: number
          review_cap: number
          review_batch_size: number
          backlog_fuse: number
          boss_every_n_new: number
          boss_stubborn_threshold: number
          mode: string
          status: string
          stats: unknown
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          user_id: string
          title: string
          scope: unknown
          new_words_per_day?: number
          review_cap?: number
          review_batch_size?: number
          backlog_fuse?: number
          boss_every_n_new?: number
          boss_stubborn_threshold?: number
          mode?: string
          status?: string
          stats?: unknown
        }
        Update: {
          title?: string
          scope?: unknown
          new_words_per_day?: number
          review_cap?: number
          review_batch_size?: number
          backlog_fuse?: number
          boss_every_n_new?: number
          boss_stubborn_threshold?: number
          mode?: string
          status?: string
          stats?: unknown
          updated_at?: string
          archived_at?: string | null
        }
      }
      adaptive_plan_word_progress: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          word_key: string
          status: string
          box_index: number | null
          target_box: number | null
          streak_wrong: number
          next_review_date: string | null
          introduced_on: string | null
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          plan_id: string
          user_id: string
          word_key: string
          status?: string
          box_index?: number | null
          target_box?: number | null
          streak_wrong?: number
          next_review_date?: string | null
          introduced_on?: string | null
        }
        Update: {
          status?: string
          box_index?: number | null
          target_box?: number | null
          streak_wrong?: number
          next_review_date?: string | null
          introduced_on?: string | null
          updated_at?: string
          archived_at?: string | null
        }
      }
      practice_pending_sessions: {
        Row: {
          user_id: string
          kind: string
          scope_key: string
          stash: unknown
          saved_at: string
        }
        Insert: {
          user_id: string
          kind: string
          scope_key: string
          stash: unknown
          saved_at?: string
        }
        Update: {
          stash?: unknown
          saved_at?: string
        }
      }
    }
  }
}
