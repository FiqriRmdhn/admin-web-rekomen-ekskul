import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          nama_lengkap: string
          username: string
          password: string
          foto_url: string | null
          is_admin: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nama_lengkap: string
          username: string
          password: string
          foto_url?: string | null
          is_admin?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nama_lengkap?: string
          username?: string
          password?: string
          foto_url?: string | null
          is_admin?: boolean | null
          created_at?: string | null
        }
      }
      questions: {
        Row: {
          id: number
          text: string
          category: string
        }
        Insert: {
          id?: number
          text: string
          category: string
        }
        Update: {
          id?: number
          text?: string
          category?: string
        }
      }
      ekstrakurikuler: {
        Row: {
          id: string
          nama: string
          kategori: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nama: string
          kategori?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nama?: string
          kategori?: string[] | null
          created_at?: string | null
        }
      }
      responses: {
        Row: {
          id: number
          user_id: string
          question_id: number
          score: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          question_id: number
          score: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          question_id?: number
          score?: number
          created_at?: string
        }
      }
      ratings: {
        Row: {
          id: number
          user_id: string | null
          ekskul_id: string | null
          rating: number | null
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id?: string | null
          ekskul_id?: string | null
          rating?: number | null
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string | null
          ekskul_id?: string | null
          rating?: number | null
          created_at?: string | null
        }
      }
    }
  }
}
