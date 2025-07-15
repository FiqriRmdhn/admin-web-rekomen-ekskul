import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Cache untuk data ekstrakurikuler agar tidak fetch berulang
let ekskulsCache: any[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

// Hitung cosine similarity antara dua vektor rating
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a).filter((k) => k in b)
  if (keys.length === 0) return 0

  let dot = 0, normA = 0, normB = 0
  keys.forEach((k) => {
    dot   += a[k] * b[k]
    normA += a[k] * a[k]
    normB += b[k] * b[k]
  })
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Ambil daftar ekstrakurikuler dengan cache
async function getCachedEkskuls() {
  const now = Date.now()
  if (ekskulsCache && now - cacheTimestamp < CACHE_DURATION) {
    return ekskulsCache
  }
  const { data, error } = await supabase
    .from("ekstrakurikuler")
    .select("id, nama, kategori")
  ekskulsCache   = data || []
  cacheTimestamp = now
  return ekskulsCache
}

// CF only: user‑based + item‑based
async function getRekomendasiEkskul(
  userId: string,
  allRatings: any[],
  ekskuls: any[]
) {
  // 1) Ambil rating milik user target
  const userRatings = allRatings.filter(r => r.user_id === userId)
  if (userRatings.length === 0) return []

  // 2) Bangun profil semua user: { uid: { ekskulId: rating, … } }
  const profiles: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const uid = r.user_id  as string
    const eid = r.ekskul_id as string
    const rt  = r.rating    as number
    if (!profiles[uid]) profiles[uid] = {}
    profiles[uid][eid] = rt
  })

  const myProfile = profiles[userId]
  const ratedSet  = new Set(Object.keys(myProfile))

  // 3) User‑based CF
  const userBased: Record<string, number> = {}
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= 0.1) continue
    for (const [eid, rating] of Object.entries(prof)) {
      if (ratedSet.has(eid)) continue
      userBased[eid] = (userBased[eid] || 0) + rating * sim
    }
  }

  // 4) Item‑based CF
  const itemUser: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const eid = r.ekskul_id as string
    const uid = r.user_id   as string
    const rt  = r.rating    as number
    if (!itemUser[eid]) itemUser[eid] = {}
    itemUser[eid][uid] = rt
  })

  const itemBased: Record<string, number> = {}
  for (const [eid, rt] of Object.entries(myProfile)) {
    for (const [otherEid, uMap] of Object.entries(itemUser)) {
      if (otherEid === eid || ratedSet.has(otherEid)) continue
      const sim = cosineSimilarity(itemUser[eid], uMap)
      if (sim <= 0.1) continue
      itemBased[otherEid] = (itemBased[otherEid] || 0) + sim * rt
    }
  }

  // 5) Gabungkan skor CF dan urutkan
  const finalScores: Record<string, number> = {}
  ekskuls.forEach(eks => {
    const eid   = eks.id as string
    const u     = userBased[eid] || 0
    const i     = itemBased[eid] || 0
    const total = u * 0.5 + i * 0.5
    if (total > 0) finalScores[eid] = total
  })

  const sorted = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  // 6) Kembalikan dengan struktur objek ekskul + skor
  return sorted
    .map(([eid, skor]) => {
      const eks = ekskuls.find(x => x.id === eid)
      if (!eks) return null
      return { ...eks, skor }
    })
    .filter(Boolean)
}

// API handler
export async function GET() {
  try {
    // 1) Fetch users, ratings, dan ekstrakurikuler
    const [uRes, rRes, ekskuls] = await Promise.all([
      supabase
        .from("users")
        .select("id, nama_lengkap, username, foto_url")
        .eq("is_admin", false),
      supabase.from("ratings").select("*"),
      getCachedEkskuls(),
    ])

    if (uRes.error || rRes.error) {
      return NextResponse.json({ error: "Fetch error" }, { status: 500 })
    }

    const users      = uRes.data     || []
    const allRatings = rRes.data     || []
    const recommendations: any[] = []

    // 2) Proses per batch 5 user
    const batchSize = 5
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const batchRecs = await Promise.all(batch.map(async user => {
        const recs = await getRekomendasiEkskul(user.id, allRatings, ekskuls)
        const top3 = recs.slice(0, 3).map((rec: any, idx: number) => ({
          rank: idx + 1,
          ekskul_nama: rec.nama,
          confidence_score: Math.min(rec.skor / 10, 1),
          raw_score: rec.skor,
          matching_categories: rec.kategori || [],  // tetap gunakan kategori dari DB
          is_best: idx === 0,
        }))
        return {
          user_id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          foto_url: user.foto_url,
          recommendations: top3,
        }
      }))
      recommendations.push(...batchRecs)
    }

    return NextResponse.json(recommendations)
  } catch (err) {
    console.error("Recommendation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
