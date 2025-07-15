import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Cosine similarity untuk dua vektor nilai
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const commonKeys = Object.keys(a).filter((key) => key in b)
  if (commonKeys.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (const key of commonKeys) {
    dot += a[key] * b[key]
  }

  for (const value of Object.values(a)) {
    normA += value * value
  }

  for (const value of Object.values(b)) {
    normB += value * value
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Fungsi untuk mendapatkan rekomendasi ekstrakurikuler untuk satu user
async function getRekomendasiEkskul(userId: string) {
  // 1) Tarik data dari keempat tabel
  const { data: ratings } = await supabase.from("ratings").select("*")
  const { data: responses } = await supabase.from("responses").select("*")
  const { data: questions } = await supabase.from("questions").select("id, category")
  const { data: ekskuls } = await supabase.from("ekstrakurikuler").select("*")

  if (!ratings || !responses || !questions || !ekskuls) {
    return []
  }

  // 2) Buat mapping question_id → category
  const qCat: Record<number, string> = {}
  questions.forEach((q) => {
    qCat[q.id] = q.category
  })

  // 3) Bangun profil tiap user
  const profiles: Record<string, Record<string, number>> = {}

  // Profil dari ratings
  ratings.forEach((r) => {
    const uid = r.user_id as string
    const ekskulId = r.ekskul_id as string
    const rate = r.rating as number

    if (!profiles[uid]) profiles[uid] = {}
    profiles[uid][r_${ekskulId}] = rate
  })

  // Profil dari responses (berdasarkan kategori)
  responses.forEach((r) => {
    const uid = r.user_id as string
    const qid = r.question_id as number
    const score = r.score as number
    const category = qCat[qid]

    if (!category) return

    if (!profiles[uid]) profiles[uid] = {}
    const key = q_${category}
    profiles[uid][key] = (profiles[uid][key] || 0) + score
  })

  // 4) Profil minat berdasarkan kategori untuk user aktif
  const kategoriMinat: Record<string, number> = {}
  responses
    .filter((r) => r.user_id === userId)
    .forEach((r) => {
      const qid = r.question_id as number
      const score = r.score as number
      const kategori = qCat[qid]

      if (!kategori) return
      kategoriMinat[kategori] = (kategoriMinat[kategori] || 0) + score
    })

  // 5) Ambil profil user aktif
  const myProfile = profiles[userId] || {}
  if (Object.keys(myProfile).length === 0) return []

  // 6) USER-BASED CF
  const userBased: Record<string, number> = {}
  Object.entries(profiles).forEach(([otherId, prof]) => {
    if (otherId === userId) return

    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= 0) return

    ratings
      .filter((r) => r.user_id === otherId)
      .forEach((r) => {
        const eid = r.ekskul_id as string
        const rt = r.rating as number

        // Cek apakah user sudah rating ekskul ini
        const seen = ratings.some((x) => x.user_id === userId && x.ekskul_id === eid)
        if (seen) return

        userBased[eid] = (userBased[eid] || 0) + rt * sim
      })
  })

  // 7) ITEM-BASED CF
  const itemUser: Record<string, Record<string, number>> = {}
  ratings.forEach((r) => {
    const eid = r.ekskul_id as string
    const uid = r.user_id as string
    const rt = r.rating as number

    if (!itemUser[eid]) itemUser[eid] = {}
    itemUser[eid][uid] = rt
  })

  const myRatings = ratings.filter((r) => r.user_id === userId)
  const itemBased: Record<string, number> = {}

  myRatings.forEach((r) => {
    const eid = r.ekskul_id as string
    const rt = r.rating as number

    Object.entries(itemUser).forEach(([otherEid, uMap]) => {
      if (otherEid === eid) return
      if (myRatings.some((x) => x.ekskul_id === otherEid)) return

      const sim = cosineSimilarity(itemUser[eid] || {}, uMap)
      if (sim <= 0) return

      itemBased[otherEid] = (itemBased[otherEid] || 0) + sim * rt
    })
  })

  // 8) Gabungkan skor userBased & itemBased + boost berdasarkan minat kategori
  const finalScores: Record<string, number> = {}

  ekskuls.forEach((eks) => {
    const eid = eks.id as string
    const u = userBased[eid] || 0
    const i = itemBased[eid] || 0
    const baseScore = (u + i) / 2

    // Ambil daftar kategori ekskul
    const kategoriEkskul = eks.kategori || []

    // Tambahkan skor preferensi pengguna terhadap kategori tersebut
    let kategoriBoost = 0
    kategoriEkskul.forEach((k: string) => {
      kategoriBoost += (kategoriMinat[k] || 0) * 0.1 // bobot bisa disesuaikan
    })

    finalScores[eid] = baseScore + kategoriBoost
  })

  // 9) Sort dan kembalikan top 3
  const sortedScores = Object.entries(finalScores).sort(([, a], [, b]) => b - a)

  return sortedScores
    .slice(0, 3) // Ambil top 3
    .map(([eid, skor], index) => {
      const eks = ekskuls.find((x) => x.id === eid)
      if (!eks) return null

      return {
        rank: index + 1,
        ekskul_nama: eks.nama,
        confidence_score: Math.min(skor / 10, 1), // Normalize to 0-1
        raw_score: skor,
        matching_categories: eks.kategori || [],
        is_best: index === 0, // First recommendation is the best
      }
    })
    .filter(Boolean)
}

export async function GET() {
  try {
    // Get all non-admin users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, nama_lengkap, username, foto_url")
      .eq("is_admin", false)

    if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Generate recommendations for each user
    const recommendations = []

    for (const user of users || []) {
      const userRecommendations = await getRekomendasiEkskul(user.id)

      recommendations.push({
        user_id: user.id,
        nama_lengkap: user.nama_lengkap,
        username: user.username,
        foto_url: user.foto_url,
        recommendations: userRecommendations,
      })
    }

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
