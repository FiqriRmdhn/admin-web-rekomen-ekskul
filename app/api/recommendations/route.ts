import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Cache data ekskul agar tidak fetch berulang
let ekskulsCache: any[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

// Hitung cosine similarity antara dua vektor rating
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a).filter((k) => k in b)
  if (keys.length === 0) return 0

  let dot = 0, normA = 0, normB = 0
  keys.forEach((k) => {
    dot += a[k] * b[k]
    normA += a[k] * a[k]
    normB += b[k] * b[k]
  })

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Ambil data ekskul dengan cache
async function getCachedEkskuls() {
  const now = Date.now()
  if (ekskulsCache && now - cacheTimestamp < CACHE_DURATION) {
    return ekskulsCache
  }

  const result = await supabase.from("ekstrakurikuler").select("*")
  ekskulsCache = result.data || []
  cacheTimestamp = now
  return ekskulsCache
}

// Fungsi utama rekomendasi untuk 1 user
async function getRekomendasiEkskul(
  userId: string,
  allRatings: any[],
  ekskuls: any[],
) {
  const userRatings = allRatings.filter((r) => r.user_id === userId)
  if (userRatings.length === 0) return []

  // Bangun profil user { user_id: { ekskul_id: rating } }
  const profiles: Record<string, Record<string, number>> = {}
  allRatings.forEach((r) => {
    const uid = r.user_id as string
    const eid = r.ekskul_id as string
    const rt = r.rating as number

    if (!profiles[uid]) profiles[uid] = {}
    profiles[uid][eid] = rt
  })

  const myProfile = profiles[userId]
  const userRatedIds = new Set(Object.keys(myProfile))

  // USER-BASED CF
  const userBased: Record<string, number> = {}
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= 0.1) continue

    for (const [eid, rating] of Object.entries(prof)) {
      if (userRatedIds.has(eid)) continue
      userBased[eid] = (userBased[eid] || 0) + rating * sim
    }
  }

  // ITEM-BASED CF
  const itemUser: Record<string, Record<string, number>> = {}
  allRatings.forEach((r) => {
    const eid = r.ekskul_id as string
    const uid = r.user_id as string
    const rt = r.rating as number

    if (!itemUser[eid]) itemUser[eid] = {}
    itemUser[eid][uid] = rt
  })

  const itemBased: Record<string, number> = {}
  for (const [eid, rt] of Object.entries(myProfile)) {
    for (const [otherEid, uMap] of Object.entries(itemUser)) {
      if (otherEid === eid || userRatedIds.has(otherEid)) continue
      const sim = cosineSimilarity(itemUser[eid], uMap)
      if (sim <= 0.1) continue
      itemBased[otherEid] = (itemBased[otherEid] || 0) + sim * rt
    }
  }

  // Gabungkan skor user-based dan item-based
  const finalScores: Record<string, number> = {}
  ekskuls.forEach((eks) => {
    const eid = eks.id as string
    const u = userBased[eid] || 0
    const i = itemBased[eid] || 0
    const total = u * 0.5 + i * 0.5
    if (total > 0) finalScores[eid] = total
  })

  // Urutkan dan kembalikan hasil
  const sorted = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  return sorted
    .map(([eid, skor]) => {
      const eks = ekskuls.find((x) => x.id === eid)
      if (!eks) return null
      return { ...eks, skor }
    })
    .filter(Boolean)
}

// API handler
export async function GET() {
  try {
    const [usersResult, ratingsResult, ekskuls] = await Promise.all([
      supabase.from("users").select("id, nama_lengkap, username, foto_url").eq("is_admin", false),
      supabase.from("ratings").select("*"),
      getCachedEkskuls(),
    ])

    if (usersResult.error) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    const users = usersResult.data || []
    const allRatings = ratingsResult.data || []
    const recommendations = []

    // Batch proses user
    const batchSize = 5
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const batchPromises = batch.map(async (user) => {
        const userRecs = await getRekomendasiEkskul(user.id, allRatings, ekskuls)

        const top3 = userRecs.slice(0, 3).map((rec: any, index) => ({
          rank: index + 1,
          ekskul_nama: rec.nama,
          confidence_score: Math.min(rec.skor / 10, 1),
          raw_score: rec.skor,
          is_best: index === 0,
        }))

        return {
          user_id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          foto_url: user.foto_url,
          recommendations: top3,
        }
      })

      const batchResults = await Promise.all(batchPromises)
      recommendations.push(...batchResults)
    }

    return NextResponse.json(recommendations)
  } catch (err) {
    console.error("Recommendation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
