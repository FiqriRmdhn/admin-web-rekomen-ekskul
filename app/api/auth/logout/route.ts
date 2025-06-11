import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear the admin token cookie
  response.cookies.set("admin-token", "", {
    expires: new Date(0),
    path: "/",
  })

  return response
}
