import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { text, category } = await request.json()

    if (!text || !category) {
      return NextResponse.json({ error: "Text dan category harus diisi" }, { status: 400 })
    }

    const { data, error } = await supabase.from("questions").update({ text, category }).eq("id", params.id).select()

    if (error) {
      return NextResponse.json({ error: "Failed to update question" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("questions").delete().eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete question" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
