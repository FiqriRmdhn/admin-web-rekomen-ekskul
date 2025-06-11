import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Get total users (non-admin)
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", false)

    // Get total ekstrakurikuler
    const { count: totalEkskul } = await supabase.from("ekstrakurikuler").select("*", { count: "exact", head: true })

    // Get total responses
    const { count: totalResponses } = await supabase.from("responses").select("*", { count: "exact", head: true })

    // Get total ratings
    const { count: totalRatings } = await supabase.from("ratings").select("*", { count: "exact", head: true })

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalEkskul: totalEkskul || 0,
      totalResponses: totalResponses || 0,
      totalRatings: totalRatings || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
