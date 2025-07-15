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

  // Optimasi: hitung norm hanya untuk keys yang ada
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

  // Fetch data secara parallel
  const [questionsResult, ekskulsResult] = await Promise.all([
    supabase.from("questions").select("id, category"),
    supabase.from("ekstrakurikuler").select("*"),
  ])

  questionsCache = questionsResult.data || []
  ekskulsCache = ekskulsResult.data || []
  cacheTimestamp = now

  return { questions: questionsCache, ekskuls: ekskulsCache }
}

// Fungsi untuk mendapatkan rekomendasi ekstrakurikuler untuk satu user (optimized)
async function getRekomendasiEkskul(
  userId: string,
  allRatings: any[],
  allResponses: any[],
  questions: any[],
  ekskuls: any[],
) {
  // Filter data untuk user ini dan user lain secara efisien
  const userRatings = allRatings.filter((r) => r.user_id === userId)
  const userResponses = allResponses.filter((r) => r.user_id === userId)

  // Early return jika user tidak punya data
  if (userRatings.length === 0 && userResponses.length === 0) {
    return []
  }

  // 2. Mapping question_id ke kategori (pre-computed)
  const qCat: Record<number, string> = {}
  questions.forEach((q) => {
    qCat[q.id] = q.category
  })

  // 3. Bangun profil user berdasarkan rating dan respons minat
  const profiles: Record<string, Record<string, number>> = {}

  // Optimasi: Build profiles hanya untuk user yang relevan
  const relevantUserIds = new Set([userId])

  // Tambahkan user yang punya rating pada ekskul yang sama dengan user aktif
  const userEkskulIds = new Set(userRatings.map((r) => r.ekskul_id))
  allRatings.forEach((r) => {
    if (userEkskulIds.has(r.ekskul_id)) {
      relevantUserIds.add(r.user_id)
    }
  })

  // Build profiles hanya untuk relevant users
  allRatings.forEach((r) => {
    if (!relevantUserIds.has(r.user_id)) return

    const uid = r.user_id as string
    const ekskulId = r.ekskul_id as string
    const rate = r.rating as number

    if (!profiles[uid]) profiles[uid] = {}
    profiles[uid][`r_${ekskulId}`] = rate
  })

  allResponses.forEach((r) => {
    if (!relevantUserIds.has(r.user_id)) return

    const uid = r.user_id as string
    const qid = r.question_id as number
    const score = r.score as number
    const category = qCat[qid]

    if (!category) return

    if (!profiles[uid]) profiles[uid] = {}
    const key = `q_${category}`
    profiles[uid][key] = (profiles[uid][key] || 0) + score
  })

  // 4. Profil minat user aktif
  const kategoriMinat: Record<string, number> = {}
  userResponses.forEach((r) => {
    const qid = r.question_id as number
    const score = r.score as number
    const kategori = qCat[qid]

    if (!kategori) return
    kategoriMinat[kategori] = (kategoriMinat[kategori] || 0) + score
  })

  // 5. Ambil profil user aktif
  const myProfile = profiles[userId] || {}
  if (Object.keys(myProfile).length === 0) return []

  // 6. User-based CF → kontribusi dari user lain (dibuat kecil)
  const userBased: Record<string, number> = {}
  const userRatedEkskuls = new Set(userRatings.map((r) => r.ekskul_id))

  Object.entries(profiles).forEach(([otherId, prof]) => {
    if (otherId === userId) return

    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= 0.1) return // Threshold untuk mengurangi noise

    allRatings
      .filter((r) => r.user_id === otherId && !userRatedEkskuls.has(r.ekskul_id))
      .forEach((r) => {
        const eid = r.ekskul_id as string
        const rt = r.rating as number
        userBased[eid] = (userBased[eid] || 0) + rt * sim
      })
  })

  // 7. Item-based CF → kontribusi dari data user sendiri (dibuat dominan)
  const itemUser: Record<string, Record<string, number>> = {}
  allRatings.forEach((r) => {
    const eid = r.ekskul_id as string
    const uid = r.user_id as string
    const rt = r.rating as number

    if (!itemUser[eid]) itemUser[eid] = {}
    itemUser[eid][uid] = rt
  })

  const itemBased: Record<string, number> = {}
  const userRatedEkskulIds = userRatings.map((r) => r.ekskul_id)

  userRatings.forEach((r) => {
    const eid = r.ekskul_id as string
    const rt = r.rating as number

    Object.entries(itemUser).forEach(([otherEid, uMap]) => {
      if (otherEid === eid || userRatedEkskulIds.includes(otherEid)) return

      const sim = cosineSimilarity(itemUser[eid] || {}, uMap)
      if (sim <= 0.1) return // Threshold untuk mengurangi noise

      itemBased[otherEid] = (itemBased[otherEid] || 0) + sim * rt
    })
  })

  // 8. Gabungkan semua skor
  const finalScores: Record<string, number> = {}

  ekskuls.forEach((eks) => {
    const eid = eks.id as string
    const u = userBased[eid] || 0
    const i = itemBased[eid] || 0

    // Bobot kontribusi: userBased (0.1), itemBased (1.9)
    const baseScore = u * 0.2 + i * 0.2

    // Boost berdasarkan kategori minat
    const kategoriEkskul = eks.kategori || []
    let kategoriBoost = 0
    kategoriEkskul.forEach((k: string) => {
      kategoriBoost += (kategoriMinat[k] || 0) * 0.2
    })

    // Boost jika user sendiri pernah memberi rating pada ekskul tsb
    const myRating = userRatings.find((r) => r.ekskul_id === eid)
    let selfBoost = 0
    if (myRating) {
      const ratingValue = myRating.rating as number
      selfBoost += ratingValue * 0.4
    }

    // Skor akhir ekskul
    const totalScore = baseScore + kategoriBoost + selfBoost
    if (totalScore > 0) {
      // Hanya simpan yang punya skor positif
      finalScores[eid] = totalScore
    }
  })

  // 9. Urutkan berdasarkan skor tertinggi
  const sortedScores = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10) // Ambil top 10 saja untuk efisiensi

  // 10. Kembalikan data ekskul beserta skor
  return sortedScores
    .map(([eid, skor]) => {
      const eks = ekskuls.find((x) => x.id === eid)
      if (!eks) return null

      return {
        ...eks,
        skor: skor,
      }
    })
    .filter(Boolean)
}

export async function GET() {
  try {
    // Fetch semua data secara parallel
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

    // Process users in parallel dengan batching
    const batchSize = 5 // Process 5 users at a time
    const recommendations = []

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)

      const batchPromises = batch.map(async (user) => {
        const userRecommendations = await getRekomendasiEkskul(user.id, allRatings, allResponses, questions, ekskuls)

        // Ambil top 3 untuk ditampilkan
        const top3Recommendations = userRecommendations.slice(0, 3).map((rec: any, index) => ({
          rank: index + 1,
          ekskul_nama: rec.nama,
          confidence_score: Math.min(rec.skor / 10, 1),
          raw_score: rec.skor,
          matching_categories: rec.kategori || [],
          is_best: index === 0,
        }))

        return {
          user_id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          foto_url: user.foto_url,
          recommendations: top3Recommendations,
        }
      })

      const batchResults = await Promise.all(batchPromises)
      recommendations.push(...batchResults)
    }

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
