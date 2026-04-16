import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
