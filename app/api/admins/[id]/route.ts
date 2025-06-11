import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { nama_lengkap, username, foto_url } = await request.json()

    if (!nama_lengkap || !username) {
      return NextResponse.json({ error: "Nama lengkap dan username harus diisi" }, { status: 400 })
    }

    // Check if username already exists (excluding current admin)
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .neq("id", params.id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("users")
      .update({ nama_lengkap, username, foto_url: foto_url || null })
      .eq("id", params.id)
      .eq("is_admin", true)
      .select()

    if (error) {
      return NextResponse.json({ error: "Failed to update admin" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("users").delete().eq("id", params.id).eq("is_admin", true)

    if (error) {
      return NextResponse.json({ error: "Failed to delete admin" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
