import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseAuthOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Single-tab app — bypass Web Locks to prevent "Lock broken by steal" AbortErrors
    // when multiple hooks issue concurrent Supabase requests on the same page.
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
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
        Row: { id: string; user_id: string; problem_id: string; solved_at: string; solve_count: number }
        Insert: { user_id: string; problem_id: string; solved_at?: string; solve_count?: number }
      }
      math_wrong: {
        Row: { user_id: string; problem_id: string; added_at: string }
        Insert: { user_id: string; problem_id: string; added_at?: string }
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
        }
        Insert: {
          user_id: string
          title: string
          problems: unknown
          score?: number | null
          total_score: number
          answers?: unknown | null
          completed_at?: string | null
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
    }
  }
}
