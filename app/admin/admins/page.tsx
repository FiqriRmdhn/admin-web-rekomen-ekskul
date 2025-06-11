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
import { Loader2, Plus, Edit, Trash2, Search, Eye, EyeOff } from "lucide-react"

interface Admin {
  id: string
  nama_lengkap: string
  username: string
  foto_url: string | null
  created_at: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [filteredAdmins, setFilteredAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    username: "",
    password: "",
    foto_url: "",
  })
  const [error, setError] = useState("")

  useEffect(() => {
    fetchAdmins()
  }, [])

  useEffect(() => {
    filterAdmins()
  }, [admins, searchTerm])

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/admins")
      const data = await response.json()
      setAdmins(data)
    } catch (error) {
      console.error("Error fetching admins:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterAdmins = () => {
    const filtered = admins.filter((admin) => admin.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()))
    setFilteredAdmins(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : "/api/admins"
      const method = editingAdmin ? "PUT" : "POST"

      const body = editingAdmin
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
        setEditingAdmin(null)
        setFormData({ nama_lengkap: "", username: "", password: "", foto_url: "" })
        fetchAdmins()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to save admin")
      }
    } catch (error) {
      setError("Network error occurred")
    }
  }

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin)
    setFormData({
      nama_lengkap: admin.nama_lengkap,
      username: admin.username,
      password: "",
      foto_url: admin.foto_url || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus admin ini?")) {
      try {
        const response = await fetch(`/api/admins/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchAdmins()
        }
      } catch (error) {
        console.error("Error deleting admin:", error)
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Admin</h1>
          <p className="text-muted-foreground">Kelola semua admin yang memiliki akses ke sistem</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingAdmin(null)
                setFormData({ nama_lengkap: "", username: "", password: "", foto_url: "" })
                setError("")
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAdmin ? "Edit Admin" : "Tambah Admin"}</DialogTitle>
              <DialogDescription>
                {editingAdmin ? "Edit informasi admin" : "Tambahkan admin baru ke sistem"}
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

              {!editingAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
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
                <Button type="submit">{editingAdmin ? "Update" : "Tambah"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Admin</CardTitle>
          <CardDescription>Semua admin yang memiliki akses ke sistem</CardDescription>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={admin.foto_url || undefined} />
                        <AvatarFallback>
                          {admin.nama_lengkap
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{admin.nama_lengkap}</span>
                    </TableCell>
                    <TableCell>{admin.username}</TableCell>
                    <TableCell>
                      <Badge variant="default">Admin</Badge>
                    </TableCell>
                    <TableCell>{formatDate(admin.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(admin)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(admin.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
