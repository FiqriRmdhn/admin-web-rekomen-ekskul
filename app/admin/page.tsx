"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Target, History, Trophy } from "lucide-react"

interface DashboardStats {
  totalUsers: number
  totalEkskul: number
  totalResponses: number
  totalRatings: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalEkskul: 0,
    totalResponses: 0,
    totalRatings: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      description: "Pengguna terdaftar",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Ekstrakurikuler",
      value: stats.totalEkskul,
      description: "Total ekstrakurikuler",
      icon: Trophy,
      color: "text-green-600",
    },
    {
      title: "Responses",
      value: stats.totalResponses,
      description: "Jawaban kuesioner",
      icon: History,
      color: "text-purple-600",
    },
    {
      title: "Ratings",
      value: stats.totalRatings,
      description: "Rating ekstrakurikuler",
      icon: Target,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Selamat datang di panel admin sistem rekomendasi ekstrakurikuler</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
