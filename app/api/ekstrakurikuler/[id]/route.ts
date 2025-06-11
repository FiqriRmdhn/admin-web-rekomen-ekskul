import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { nama, kategori } = await request.json()

    const { data, error } = await supabase
      .from("ekstrakurikuler")
      .update({ nama, kategori })
      .eq("id", params.id)
      .select()

    if (error) {
      return NextResponse.json({ error: "Failed to update ekstrakurikuler" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("ekstrakurikuler").delete().eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete ekstrakurikuler" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
