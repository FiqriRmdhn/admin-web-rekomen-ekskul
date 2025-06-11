"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Loader2, Plus, Edit, Trash2, Search } from "lucide-react"

interface Question {
  id: number
  text: string
  category: string
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [formData, setFormData] = useState({
    text: "",
    category: "",
  })
  const [error, setError] = useState("")

  useEffect(() => {
    fetchQuestions()
  }, [])

  useEffect(() => {
    filterQuestions()
  }, [questions, searchTerm])

  const fetchQuestions = async () => {
    try {
      const response = await fetch("/api/questions")
      const data = await response.json()
      setQuestions(data)
    } catch (error) {
      console.error("Error fetching questions:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterQuestions = () => {
    const filtered = questions.filter(
      (question) =>
        question.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        question.category.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredQuestions(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : "/api/questions"
      const method = editingQuestion ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setDialogOpen(false)
        setEditingQuestion(null)
        setFormData({ text: "", category: "" })
        fetchQuestions()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to save question")
      }
    } catch (error) {
      setError("Network error occurred")
    }
  }

  const handleEdit = (question: Question) => {
    setEditingQuestion(question)
    setFormData({
      text: question.text,
      category: question.category,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus pertanyaan ini?")) {
      try {
        const response = await fetch(`/api/questions/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchQuestions()
        }
      } catch (error) {
        console.error("Error deleting question:", error)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pertanyaan</h1>
          <p className="text-muted-foreground">Kelola semua pertanyaan kuesioner dalam sistem</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingQuestion(null)
                setFormData({ text: "", category: "" })
                setError("")
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Pertanyaan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? "Edit Pertanyaan" : "Tambah Pertanyaan"}</DialogTitle>
              <DialogDescription>
                {editingQuestion ? "Edit pertanyaan kuesioner" : "Tambahkan pertanyaan baru ke kuesioner"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="text">Teks Pertanyaan</Label>
                <Textarea
                  id="text"
                  value={formData.text}
                  onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
                  required
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  required
                  placeholder="Contoh: Olahraga, Seni, Akademik"
                />
              </div>

              <DialogFooter>
                <Button type="submit">{editingQuestion ? "Update" : "Tambah"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pertanyaan</CardTitle>
          <CardDescription>Semua pertanyaan kuesioner yang tersedia</CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan pertanyaan atau kategori..."
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
                  <TableHead>ID</TableHead>
                  <TableHead>Pertanyaan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">{question.id}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate">{question.text}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{question.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(question)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(question.id)}>
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
