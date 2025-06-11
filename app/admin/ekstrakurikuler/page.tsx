"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Ekstrakurikuler {
  id: string
  nama: string
  kategori: string[]
  created_at: string
}

interface Category {
  category: string
}

type SortField = "nama" | "created_at"
type SortOrder = "asc" | "desc"

export default function EkstrakurikulerPage() {
  const [ekskuls, setEkskuls] = useState<Ekstrakurikuler[]>([])
  const [sortedEkskuls, setSortedEkskuls] = useState<Ekstrakurikuler[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEkskul, setEditingEkskul] = useState<Ekstrakurikuler | null>(null)
  const [formData, setFormData] = useState({
    nama: "",
    kategori: [] as string[],
  })
  const [error, setError] = useState("")
  const [sortField, setSortField] = useState<SortField>("nama")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  useEffect(() => {
    fetchEkskuls()
    fetchCategories()
  }, [])

  useEffect(() => {
    sortEkskuls()
  }, [ekskuls, sortField, sortOrder])

  const fetchEkskuls = async () => {
    try {
      const response = await fetch("/api/ekstrakurikuler")
      const data = await response.json()
      setEkskuls(data)
    } catch (error) {
      console.error("Error fetching ekstrakurikuler:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories")
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingEkskul ? `/api/ekstrakurikuler/${editingEkskul.id}` : "/api/ekstrakurikuler"

      const method = editingEkskul ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setDialogOpen(false)
        setEditingEkskul(null)
        setFormData({ nama: "", kategori: [] })
        fetchEkskuls()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to save ekstrakurikuler")
      }
    } catch (error) {
      setError("Network error occurred")
    }
  }

  const handleEdit = (ekskul: Ekstrakurikuler) => {
    setEditingEkskul(ekskul)
    setFormData({
      nama: ekskul.nama,
      kategori: ekskul.kategori || [],
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus ekstrakurikuler ini?")) {
      try {
        const response = await fetch(`/api/ekstrakurikuler/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchEkskuls()
        }
      } catch (error) {
        console.error("Error deleting ekstrakurikuler:", error)
      }
    }
  }

  const handleCategoryToggle = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      kategori: prev.kategori.includes(category)
        ? prev.kategori.filter((k) => k !== category)
        : [...prev.kategori, category],
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const sortEkskuls = () => {
    const sorted = [...ekskuls].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === "created_at") {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      } else if (sortField === "nama") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    setSortedEkskuls(sorted)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ekstrakurikuler</h1>
          <p className="text-muted-foreground">Kelola semua ekstrakurikuler yang tersedia</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingEkskul(null)
                setFormData({ nama: "", kategori: [] })
                setError("")
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Ekstrakurikuler
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEkskul ? "Edit Ekstrakurikuler" : "Tambah Ekstrakurikuler"}</DialogTitle>
              <DialogDescription>
                {editingEkskul ? "Edit informasi ekstrakurikuler" : "Tambahkan ekstrakurikuler baru"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="nama">Nama Ekstrakurikuler</Label>
                <Input
                  id="nama"
                  value={formData.nama}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nama: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Kategori</Label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={category}
                        checked={formData.kategori.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                        className="rounded"
                      />
                      <Label htmlFor={category} className="text-sm">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit">{editingEkskul ? "Update" : "Tambah"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Ekstrakurikuler</CardTitle>
          <CardDescription>Semua ekstrakurikuler yang tersedia dalam sistem</CardDescription>
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
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort("nama")} className="h-auto p-0 font-semibold">
                      Nama
                      {getSortIcon("nama")}
                    </Button>
                  </TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("created_at")}
                      className="h-auto p-0 font-semibold"
                    >
                      Tanggal Dibuat
                      {getSortIcon("created_at")}
                    </Button>
                  </TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEkskuls.map((ekskul) => (
                  <TableRow key={ekskul.id}>
                    <TableCell className="font-medium">{ekskul.nama}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {ekskul.kategori?.map((kategori) => (
                          <Badge key={kategori} variant="secondary">
                            {kategori}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(ekskul.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(ekskul)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(ekskul.id)}>
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
