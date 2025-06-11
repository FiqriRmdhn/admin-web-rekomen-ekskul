import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const userId = params.userId

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, nama_lengkap, username, foto_url")
      .eq("id", userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get user responses with question text
    const { data: responses, error: responsesError } = await supabase
      .from("responses")
      .select(`
        question_id,
        score,
        questions!inner(text)
      `)
      .eq("user_id", userId)
      .order("question_id", { ascending: true })

    if (responsesError) {
      return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 })
    }

    // Get user ratings with ekstrakurikuler names
    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select(`
        ekskul_id,
        rating,
        ekstrakurikuler!inner(nama)
      `)
      .eq("user_id", userId)
      .order("rating", { ascending: false })

    if (ratingsError) {
      return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 })
    }

    // Transform the data to match the expected format
    const transformedResponses =
      responses?.map((r: any) => ({
        question_id: r.question_id,
        score: r.score,
        question_text: r.questions.text,
      })) || []

    const transformedRatings =
      ratings?.map((r: any) => ({
        ekskul_id: r.ekskul_id,
        rating: r.rating,
        ekskul_nama: r.ekstrakurikuler.nama,
      })) || []

    return NextResponse.json({
      user,
      responses: transformedResponses,
      ratings: transformedRatings,
    })
  } catch (error) {
    console.error("Error fetching user riwayat:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
