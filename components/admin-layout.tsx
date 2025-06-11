"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Users, Target, History, Trophy, LogOut, LayoutDashboard, HelpCircle, UserPlus, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Admin", href: "/admin/admins", icon: UserPlus },
  { name: "Pertanyaan", href: "/admin/questions", icon: HelpCircle },
  { name: "Rekomendasi", href: "/admin/recommendations", icon: Target },
  { name: "Riwayat Menjawab", href: "/admin/riwayat", icon: History },
  { name: "Ekstrakurikuler", href: "/admin/ekstrakurikuler", icon: Trophy },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close sidebar when clicking outside (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    document.cookie = "admin-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white hover:bg-gray-800"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col overflow-y-auto">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1 px-2">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:text-white hover:bg-gray-800",
                          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors",
                        )}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto px-2 pb-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={handleLogout}
                >
                  <LogOut className="h-6 w-6 mr-3 shrink-0" />
                  <span className="truncate">Logout</span>
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6">
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open sidebar</span>
          </Button>
          <div className="flex-1"></div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
