"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Star, Trophy } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface UserRecommendation {
  user_id: string
  nama_lengkap: string
  username: string
  foto_url: string | null
  recommendations: {
    rank: number
    ekskul_nama: string
    confidence_score: number
    raw_score: number
    matching_categories: string[]
    is_best: boolean
  }[]
}

// Skeleton component untuk loading state
function RecommendationSkeleton() {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-12 flex-shrink-0 ml-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border bg-gray-50/50">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex space-x-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex space-x-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<UserRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    setLoading(true)
    setLoadingProgress(0)

    try {
      // Simulate progress untuk UX yang lebih baik
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch("/api/recommendations")
      const data = await response.json()

      clearInterval(progressInterval)
      setLoadingProgress(100)

      setTimeout(() => {
        setRecommendations(data)
        setLoading(false)
      }, 300)
    } catch (error) {
      console.error("Error fetching recommendations:", error)
      setLoading(false)
    }
  }

  const generateRecommendations = async () => {
    setGenerating(true)
    try {
      const response = await fetch("/api/recommendations/generate", {
        method: "POST",
      })
      if (response.ok) {
        fetchRecommendations()
      }
    } catch (error) {
      console.error("Error generating recommendations:", error)
    } finally {
      setGenerating(false)
    }
  }

  const getMatchPercentage = (score: number) => {
    return Math.min(Math.round(score * 10), 100)
  }

  const getScoreColor = (score: number) => {
    const percentage = getMatchPercentage(score)
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500 text-white"
      case 2:
        return "bg-gray-400 text-white"
      case 3:
        return "bg-amber-600 text-white"
      default:
        return "bg-gray-300 text-gray-700"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rekomendasi Per Pengguna</h1>
          <p className="text-muted-foreground">Top 3 rekomendasi ekstrakurikuler untuk setiap user</p>
        </div>

        <Button onClick={generateRecommendations} disabled={generating || loading} className="w-full sm:w-auto">
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {generating ? "Generating..." : "Generate Ulang"}
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Memproses rekomendasi... {loadingProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RecommendationSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((userRec) => (
            <Card key={userRec.user_id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={userRec.foto_url || undefined} />
                      <AvatarFallback className="bg-blue-500 text-white font-semibold">
                        {userRec.nama_lengkap
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{userRec.nama_lengkap}</CardTitle>
                      <CardDescription className="truncate">@{userRec.username}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                    Top 3
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {userRec.recommendations.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Belum ada data untuk rekomendasi</div>
                ) : (
                  userRec.recommendations.map((rec) => (
                    <div
                      key={`${userRec.user_id}-${rec.rank}`}
                      className="flex items-center space-x-3 p-3 rounded-lg border bg-gray-50/50"
                    >
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Badge
                          className={`w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs ${getRankBadgeColor(rec.rank)}`}
                        >
                          {rec.rank}
                        </Badge>
                        {rec.is_best && <Badge className="bg-blue-500 text-white text-xs px-2 py-1">Best</Badge>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 mb-1">
                          <h4 className="font-medium text-sm truncate">{rec.ekskul_nama}</h4>
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{rec.raw_score.toFixed(1)}</span>
                          </div>
                          <div className={`flex items-center space-x-1 ${getScoreColor(rec.confidence_score)}`}>
                            <Trophy className="h-3 w-3" />
                            <span>{getMatchPercentage(rec.confidence_score)}% match</span>
                          </div>
                        </div>

                        {rec.matching_categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.matching_categories.slice(0, 2).map((category) => (
                              <Badge key={category} variant="secondary" className="text-xs px-1 py-0">
                                {category}
                              </Badge>
                            ))}
                            {rec.matching_categories.length > 2 && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                +{rec.matching_categories.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && recommendations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Belum ada data rekomendasi. Klik "Generate Ulang" untuk membuat rekomendasi.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
