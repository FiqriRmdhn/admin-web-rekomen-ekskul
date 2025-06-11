import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data: questions, error } = await supabase.from("questions").select("category")

    if (error) {
      return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
    }

    // Get unique categories
    const categories = [...new Set(questions?.map((q) => q.category) || [])]

    return NextResponse.json(categories)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
