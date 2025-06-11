import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username dan password harus diisi" }, { status: 400 })
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, nama_lengkap, password, is_admin")
      .eq("username", username)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "Username atau password salah" }, { status: 401 })
    }

    // Compare password with BCrypt
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Username atau password salah" }, { status: 401 })
    }

    // Check if user is admin
    if (!user.is_admin) {
      return NextResponse.json({ error: "Akses ditolak. Hanya admin yang dapat login." }, { status: 403 })
    }

    // Create simple session token (just user data encoded)
    const sessionData = {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      is_admin: user.is_admin,
      loginTime: Date.now(),
    }

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64")

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        nama_lengkap: user.nama_lengkap,
        is_admin: user.is_admin,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 })
  }
}
