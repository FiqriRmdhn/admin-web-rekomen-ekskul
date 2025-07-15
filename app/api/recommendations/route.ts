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
  let dot = 0, normA = 0, normB = 0
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

// Ambil questions & ekskuls dengan cache
async function getCachedData() {
  const now = Date.now()
  if (questionsCache && ekskulsCache && now - cacheTimestamp < CACHE_DURATION) {
    return { questions: questionsCache, ekskuls: ekskulsCache }
  }
  const [qRes, eRes] = await Promise.all([
    supabase.from("questions").select("id, category"),
    supabase.from("ekstrakurikuler").select("*"),
  ])
  questionsCache = qRes.data || []
  ekskulsCache = eRes.data || []
  cacheTimestamp = now
  return { questions: questionsCache, ekskuls: ekskulsCache }
}

// Hybrid CF dengan personal-first
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

  // 2. Siapkan struktur
  const userRatings = allRatings.filter(r => r.user_id === userId)
  const userRatedEkskuls = new Set(userRatings.map(r => r.ekskul_id as string))
  const personalScores: Record<string, number> = {}

  // 3. Hitung skor personal untuk tiap ekskul
  // a) dari rating pribadi (langsung)
  userRatings.forEach(r => {
    const eid = r.ekskul_id as string
    personalScores[eid] = (personalScores[eid] || 0) + (r.rating as number)
  })
  // b) dari respons kuis berdasarkan kategori
  const kategoriScores: Record<string, number> = {}
  allResponses
    .filter(r => r.user_id === userId)
    .forEach(r => {
      const cat = qCat[r.question_id] || "unknown"
      kategoriScores[cat] = (kategoriScores[cat] || 0) + (r.score as number)
    })
  ekskuls.forEach(eks => {
    const eid = eks.id as string
    const cats: string[] = eks.kategori || []
    let boost = 0
    cats.forEach(cat => {
      boost += kategoriScores[cat] || 0
    })
    if (boost > 0) {
      personalScores[eid] = (personalScores[eid] || 0) + boost
    }
  })

  // 4. Jika tidak ada personal score sama sekali, langsung return []
  if (Object.keys(personalScores).length === 0) return []

  // 5. Hitung CF contributions
  // 5a. Bangun profile user (rating + respons) semua user
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

  const myProfile = profiles[userId]

  // 5b. User-Based CF
  const userBasedScores: Record<string, number> = {}
  const simThreshold = 0.1
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

  // 5c. Item-Based CF
  const itemUserMap: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const eid = r.ekskul_id as string
    const uid = r.user_id as string
    itemUserMap[eid] = itemUserMap[eid] || {}
    itemUserMap[eid][uid] = r.rating
  })
  const itemBasedScores: Record<string, number> = {}
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

  // 6. Tambahkan CF ke personalScores
  Object.keys(personalScores).forEach(eid => {
    const ub = userBasedScores[eid] || 0
    const ib = itemBasedScores[eid] || 0
    // Bobot CF total 50% (25% user, 25% item)
    personalScores[eid] += ub * 0.25 + ib * 0.25
  })

  // 7. Ranking
  const sorted = Object.entries(personalScores)
    .sort(([, a], [, b]) => b - a)

  return sorted
    .map(([eid, skor]) => {
      const eks = ekskuls.find(e => e.id === eid)
      return eks ? { ...eks, skor } : null
    })
    .filter(Boolean)
}

export async function GET() {
  try {
    const [uRes, rRes, respRes, cacheData] = await Promise.all([
      supabase.from("users").select("id, nama_lengkap, username, foto_url").eq("is_admin", false),
      supabase.from("ratings").select("*"),
      supabase.from("responses").select("*"),
      getCachedData(),
    ])
    if (uRes.error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })

    const users = uRes.data || []
    const allRatings = rRes.data || []
    const allResponses = respRes.data || []
    const { questions, ekskuls } = cacheData

    const batchSize = 5
    const recommendations: any[] = []

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(async user => {
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
      recommendations.push(...results)
    }

    return NextResponse.json(recommendations)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
