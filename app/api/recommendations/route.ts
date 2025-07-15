import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Cache untuk data yang jarang berubah
let questionsCache: any[] | null = null
let ekskulsCache: any[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 menit

// Cosine similarity untuk dua vektor nilai
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  const commonKeys = aKeys.filter((key) => key in b)

  if (commonKeys.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (const key of commonKeys) {
    dot += a[key] * b[key]
  }

  for (const key of aKeys) {
    normA += a[key] * a[key]
  }

  for (const key of bKeys) {
    normB += b[key] * b[key]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
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

// Hybrid User-Based + Item-Based CF
async function getRekomendasiEkskul(
  userId: string,
  allRatings: any[],
  allResponses: any[],
  questions: any[],
  ekskuls: any[],
) {
  // 1. Build kategori mapping
  const qCat: Record<number, string> = {}
  questions.forEach(q => { qCat[q.id] = q.category })

  // 2. Build profile per user (rating + response)
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

  // Jika profil user kosong, return []
  const myProfile = profiles[userId] || {}
  if (Object.keys(myProfile).length === 0) return []

  // Siapkan data
  const simThreshold = 0.1
  const userBasedScores: Record<string, number> = {}
  const itemBasedScores: Record<string, number> = {}
  const userRatings = allRatings.filter(r => r.user_id === userId)
  const userRatedEkskuls = new Set(userRatings.map(r => r.ekskul_id as string))

  // 3. User-Based CF
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= simThreshold) continue

    allRatings
      .filter(r => r.user_id === otherId && !userRatedEkskuls.has(r.ekskul_id as string))
      .forEach(r => {
        const eid = r.ekskul_id as string
        userBasedScores[eid] = (userBasedScores[eid] || 0) + sim * r.rating
      })
  }

  // 4. Item-Based CF
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
    Object.entries(itemUserMap).forEach(([otherEid, uMap]) => {
      if (otherEid === baseEid || userRatedEkskuls.has(otherEid)) return
      const sim = cosineSimilarity(itemUserMap[baseEid], uMap)
      if (sim <= simThreshold) return
      itemBasedScores[otherEid] = (itemBasedScores[otherEid] || 0) + sim * myRating
    })
  })

  // 5. Gabungkan skor dan ranking
  const finalScores: Record<string, number> = {}
  ekskuls.forEach(eks => {
    const eid = eks.id as string
    const uScore = userBasedScores[eid] || 0
    const iScore = itemBasedScores[eid] || 0
    const total = uScore * 0.5 + iScore * 0.5
    if (total > 0) finalScores[eid] = total
  })

  const sorted = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

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
