import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Cache untuk data yang jarang berubah
let questionsCache: any[] | null = null
let ekskulsCache: any[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

/**
 * Hitung Pearson correlation antara dua vektor nilai.
 */
function pearsonSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a).filter(k => k in b)
  const n = keys.length
  if (n === 0) return 0

  // Hitung rata-rata
  const meanA = keys.reduce((sum, k) => sum + a[k], 0) / n
  const meanB = keys.reduce((sum, k) => sum + b[k], 0) / n

  // Hitung numerator & denominators
  let num = 0, denA = 0, denB = 0
  for (const k of keys) {
    const da = a[k] - meanA
    const db = b[k] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const denom = Math.sqrt(denA * denB)
  return denom === 0 ? 0 : num / denom
}

// Fungsi untuk mendapatkan data dengan cache
async function getCachedData() {
  const now = Date.now()
  if (questionsCache && ekskulsCache && now - cacheTimestamp < CACHE_DURATION) {
    return { questions: questionsCache, ekskuls: ekskulsCache }
  }
  const [questionsResult, ekskulsResult] = await Promise.all([
    supabase.from("questions").select("id, category"),
    supabase.from("ekstrakurikuler").select("*"),
  ])
  questionsCache = questionsResult.data || []
  ekskulsCache = ekskulsResult.data || []
  cacheTimestamp = now
  return { questions: questionsCache, ekskuls: ekskulsCache }
}

// Hybrid CF dengan boost untuk jawaban user sendiri, menggunakan Pearson
async function getRekomendasiEkskul(
  userId: string,
  allRatings: any[],
  allResponses: any[],
  questions: any[],
  ekskuls: any[],
) {
  // 1. Mapping question → kategori
  const qCat: Record<number, string> = {}
  questions.forEach(q => { qCat[q.id] = q.category })

  // 2. Bangun profil per user (rating & respons)
  const profiles: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const uid = r.user_id as string
    const key = `r_${r.ekskul_id}`
    profiles[uid] = profiles[uid] || {}
    profiles[uid][key] = (profiles[uid][key] || 0) + r.rating
  })
  allResponses.forEach(r => {
    const uid = r.user_id as string
    const cat = qCat[r.question_id] || "unknown"
    const key = `q_${cat}`
    profiles[uid] = profiles[uid] || {}
    profiles[uid][key] = (profiles[uid][key] || 0) + r.score
  })

  const myProfile = profiles[userId] || {}
  if (Object.keys(myProfile).length === 0) return []

  // 3. Siapkan data untuk CF
  const simThreshold = 0.1
  const userBasedScores: Record<string, number> = {}
  const itemBasedScores: Record<string, number> = {}
  const userRatings = allRatings.filter(r => r.user_id === userId)
  const userRatedEkskuls = new Set(userRatings.map(r => r.ekskul_id as string))

  // 4. User-Based CF (Pearson)
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = pearsonSimilarity(myProfile, prof)
    if (sim <= simThreshold) continue
    allRatings
      .filter(r => r.user_id === otherId && !userRatedEkskuls.has(r.ekskul_id as string))
      .forEach(r => {
        const eid = r.ekskul_id as string
        userBasedScores[eid] = (userBasedScores[eid] || 0) + sim * r.rating
      })
  }

  // 5. Item-Based CF (Pearson)
  const itemUserMap: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const eid = r.ekskul_id as string
    const uid = r.user_id as string
    itemUserMap[eid] = itemUserMap[eid] || {}
    itemUserMap[eid][uid] = r.rating
  })
  userRatings.forEach(r => {
    const baseEid = r.ekskul_id as string
    const myRating = r.rating
    for (const [otherEid, uMap] of Object.entries(itemUserMap)) {
      if (otherEid === baseEid || userRatedEkskuls.has(otherEid)) continue
      const sim = pearsonSimilarity(itemUserMap[baseEid], uMap)
      if (sim <= simThreshold) continue
      itemBasedScores[otherEid] = (itemBasedScores[otherEid] || 0) + sim * myRating
    }
  })

  // 6. Hitung final skor dengan boost:
  //    - userCF (10%), itemCF (10%)
  //    - selfRatingBoost (70%) untuk rating pribadi
  //    - responseBoost (10%) untuk respons kuis pribadi
  const finalScores: Record<string, number> = {}
  ekskuls.forEach(eks => {
    const eid = eks.id as string
    const uScore = userBasedScores[eid] || 0
    const iScore = itemBasedScores[eid] || 0

    // Boost dari rating pribadi
    const myRateObj = userRatings.find(r => r.ekskul_id === eid)
    const selfBoost = myRateObj ? (myRateObj.rating as number) : 0

    // Boost dari respons kategori
    let respBoost = 0
    const cats: string[] = eks.kategori || []
    cats.forEach(cat => {
      const key = `q_${cat}`
      respBoost += (myProfile[key] || 0)
    })

    const total =
      uScore * 0.1 +
      iScore * 0.1 +
      selfBoost * 0.7 +
      respBoost * 0.1

    if (total > 0) {
      finalScores[eid] = total
    }
  })

  // 7. Urutkan & ambil top 10
  const sorted = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  // 8. Kembalikan data ekskul + skor
  return sorted
    .map(([eid, skor]) => {
      const eks = ekskuls.find(e => e.id === eid)
      return eks ? { ...eks, skor } : null
    })
    .filter(Boolean)
}

export async function GET() {
  try {
    const [usersResult, ratingsResult, responsesResult, cachedData] = await Promise.all([
      supabase.from("users").select("id, nama_lengkap, username, foto_url").eq("is_admin", false),
      supabase.from("ratings").select("*"),
      supabase.from("responses").select("*"),
      getCachedData(),
    ])

    if (usersResult.error) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    const users = usersResult.data || []
    const allRatings = ratingsResult.data || []
    const allResponses = responsesResult.data || []
    const { questions, ekskuls } = cachedData

    const batchSize = 5
    const recommendations: any[] = []

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(async (user) => {
        const recs = await getRekomendasiEkskul(user.id, allRatings, allResponses, questions, ekskuls)
        const top3 = recs.slice(0, 3).map((rec: any, idx: number) => ({
          rank: idx + 1,
          ekskul_nama: rec.nama,
          confidence_score: Math.min(rec.skor / 10, 1),
          raw_score: rec.skor,
          matching_categories: rec.kategori || [],
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
      recommendations.push(...batchResults)
    }

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
