"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Edit, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface User {
  id: string
  nama_lengkap: string
  username: string
  foto_url: string | null
  created_at: string
}

type SortField = "nama_lengkap" | "username" | "created_at"
type SortOrder = "asc" | "desc"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("nama_lengkap")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    username: "",
    password: "",
    foto_url: "",
  })
  const [error, setError] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterAndSortUsers()
  }, [users, searchTerm, sortField, sortOrder])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortUsers = () => {
    const filtered = users.filter((user) => user.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()))

    filtered.sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      if (sortField === "created_at") {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      } else {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    setFilteredUsers(filtered)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users"
      const method = editingUser ? "PUT" : "POST"

      const body = editingUser
        ? { nama_lengkap: formData.nama_lengkap, username: formData.username, foto_url: formData.foto_url }
        : formData

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        setDialogOpen(false)
        setEditingUser(null)
        setFormData({ nama_lengkap: "", username: "", password: "", foto_url: "" })
        fetchUsers()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to save user")
      }
    } catch (error) {
      setError("Network error occurred")
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      nama_lengkap: user.nama_lengkap,
      username: user.username,
      password: "",
      foto_url: user.foto_url || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus user ini?")) {
      try {
        const response = await fetch(`/api/users/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchUsers()
        }
      } catch (error) {
        console.error("Error deleting user:", error)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manajemen Users</h1>
          <p className="text-muted-foreground">Kelola semua pengguna yang terdaftar dalam sistem</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setEditingUser(null)
                setFormData({ nama_lengkap: "", username: "", password: "", foto_url: "" })
                setError("")
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Tambah User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Edit informasi user" : "Tambahkan user baru ke sistem"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="nama_lengkap">Nama Lengkap</Label>
                <Input
                  id="nama_lengkap"
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nama_lengkap: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="foto_url">Foto URL (Opsional)</Label>
                <Input
                  id="foto_url"
                  type="url"
                  value={formData.foto_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, foto_url: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingUser ? "Update" : "Tambah"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Users</CardTitle>
          <CardDescription>Semua pengguna non-admin yang terdaftar</CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama lengkap..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("nama_lengkap")}
                        className="h-auto p-0 font-semibold"
                      >
                        Nama Lengkap
                        {getSortIcon("nama_lengkap")}
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("username")}
                        className="h-auto p-0 font-semibold"
                      >
                        Username
                        {getSortIcon("username")}
                      </Button>
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("created_at")}
                        className="h-auto p-0 font-semibold"
                      >
                        Tanggal Daftar
                        {getSortIcon("created_at")}
                      </Button>
                    </TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                          <AvatarImage src={user.foto_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {user.nama_lengkap
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-sm sm:text-base truncate block">{user.nama_lengkap}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{user.username}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary">Active</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
