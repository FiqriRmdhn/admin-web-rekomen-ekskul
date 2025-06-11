import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data: questions, error } = await supabase.from("questions").select("*").order("id", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
    }

    return NextResponse.json(questions)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, category } = await request.json()

    if (!text || !category) {
      return NextResponse.json({ error: "Text dan category harus diisi" }, { status: 400 })
    }

    const { data, error } = await supabase.from("questions").insert([{ text, category }]).select()

    if (error) {
      return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
