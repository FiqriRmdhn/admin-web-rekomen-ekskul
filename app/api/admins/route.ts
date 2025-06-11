import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const { data: admins, error } = await supabase
      .from("users")
      .select("id, nama_lengkap, username, foto_url, created_at")
      .eq("is_admin", true)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 })
    }

    return NextResponse.json(admins)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nama_lengkap, username, password, foto_url } = await request.json()

    if (!nama_lengkap || !username || !password) {
      return NextResponse.json({ error: "Nama lengkap, username, dan password harus diisi" }, { status: 400 })
    }

    // Check if username already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert new admin
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          nama_lengkap,
          username,
          password: hashedPassword,
          foto_url: foto_url || null,
          is_admin: true,
        },
      ])
      .select()

    if (error) {
      return NextResponse.json({ error: "Gagal membuat admin" }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
