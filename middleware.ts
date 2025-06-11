import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const adminToken = request.cookies.get("admin-token")

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!adminToken) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Verify session token
    try {
      const sessionData = JSON.parse(Buffer.from(adminToken.value, "base64").toString())

      // Check if session is still valid (24 hours)
      const sessionAge = Date.now() - sessionData.loginTime
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

      if (sessionAge > maxAge) {
        const response = NextResponse.redirect(new URL("/login", request.url))
        response.cookies.delete("admin-token")
        return response
      }

      // Check if user is admin
      if (!sessionData.is_admin) {
        return NextResponse.redirect(new URL("/login", request.url))
      }
    } catch (error) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Redirect to admin if already logged in and accessing login
  if (request.nextUrl.pathname === "/login" && adminToken) {
    try {
      const sessionData = JSON.parse(Buffer.from(adminToken.value, "base64").toString())
      if (sessionData.is_admin) {
        return NextResponse.redirect(new URL("/admin", request.url))
      }
    } catch (error) {
      // Invalid token, continue to login
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
}
