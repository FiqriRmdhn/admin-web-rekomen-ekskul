"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface User {
  id: string
  nama_lengkap: string
  username: string
  foto_url: string | null
}

interface UserResponse {
  question_id: number
  score: number
  question_text: string
}

interface UserRating {
  ekskul_id: string
  rating: number
  ekskul_nama: string
}

interface UserRiwayat {
  user: User
  responses: UserResponse[]
  ratings: UserRating[]
}

export default function RiwayatPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [riwayat, setRiwayat] = useState<UserRiwayat | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRiwayat, setLoadingRiwayat] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      fetchUserRiwayat(selectedUserId)
    }
  }, [selectedUserId])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      setUsers(data)
      if (data.length > 0) {
        setSelectedUserId(data[0].id)
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRiwayat = async (userId: string) => {
    setLoadingRiwayat(true)
    try {
      const response = await fetch(`/api/riwayat/${userId}`)
      const data = await response.json()
      setRiwayat(data)
    } catch (error) {
      console.error("Error fetching user riwayat:", error)
    } finally {
      setLoadingRiwayat(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return "bg-green-500"
    if (score >= 3) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "bg-green-500"
    if (rating >= 3) return "bg-yellow-500"
    return "bg-red-500"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Menjawab</h1>
        <p className="text-muted-foreground">Lihat riwayat jawaban kuesioner dan rating ekstrakurikuler per user</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih User</CardTitle>
          <CardDescription>Pilih user untuk melihat riwayat jawaban mereka</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih user..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.foto_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {user.nama_lengkap
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {user.nama_lengkap} (@{user.username})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loadingRiwayat ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : riwayat ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Responses - Skor Jawaban */}
          <Card>
            <CardHeader>
              <CardTitle>Responses - Skor Jawaban</CardTitle>
              <CardDescription>Jawaban kuesioner yang telah diberikan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riwayat.responses.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Belum ada jawaban kuesioner</p>
              ) : (
                riwayat.responses.map((response, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getScoreColor(
                            response.score,
                          )}`}
                        >
                          {response.score}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{response.question_text}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pilihan Ekstrakurikuler */}
          <Card>
            <CardHeader>
              <CardTitle>Pilihan Ekstrakurikuler</CardTitle>
              <CardDescription>Rating ekstrakurikuler yang telah diberikan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riwayat.ratings.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Belum ada rating ekstrakurikuler</p>
              ) : (
                riwayat.ratings.map((rating, index) => (
                  <Card key={index} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getRatingColor(
                            rating.rating,
                          )}`}
                        >
                          {rating.rating}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{rating.ekskul_nama}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
