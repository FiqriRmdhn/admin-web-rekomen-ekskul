import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data: ekskuls, error } = await supabase
      .from("ekstrakurikuler")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch ekstrakurikuler" }, { status: 500 })
    }

    return NextResponse.json(ekskuls)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nama, kategori } = await request.json()

    const { data, error } = await supabase.from("ekstrakurikuler").insert([{ nama, kategori }]).select()

    if (error) {
      return NextResponse.json({ error: "Failed to create ekstrakurikuler" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
