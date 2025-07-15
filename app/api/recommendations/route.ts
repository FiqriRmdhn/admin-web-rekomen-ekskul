import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

/**
 * Hitung Pearson correlation antara dua vektor.
 */
function pearsonSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a).filter(k => k in b)
  const n = keys.length
  if (n === 0) return 0

  // Rata‑rata
  const meanA = keys.reduce((sum, k) => sum + a[k], 0) / n
  const meanB = keys.reduce((sum, k) => sum + b[k], 0) / n

  // Numerator & denominator
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

/**
 * Hitung personalScores murni dengan hybrid CF (user-based + item-based),
 * menggunakan Pearson correlation.
 */
async function calcPersonalScores(
  userId: string,
  allRatings: { user_id: string; ekskul_id: string; rating: number }[],
) {
  // 1. Build profile per user: user → { ekskul_id: total_rating }
  const profiles: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    const uid = r.user_id
    profiles[uid] = profiles[uid] || {}
    profiles[uid][r.ekskul_id] = (profiles[uid][r.ekskul_id] || 0) + r.rating
  })

  const myProfile = profiles[userId] || {}
  if (Object.keys(myProfile).length === 0) {
    // User belum punya rating
    return []
  }

  const simThreshold = 0.1
  const userBasedScores: Record<string, number> = {}

  // 2. User-Based CF (Pearson)
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = pearsonSimilarity(myProfile, prof)
    if (sim <= simThreshold) continue
    for (const [eid, r] of Object.entries(prof)) {
      if (eid in myProfile) continue
      userBasedScores[eid] = (userBasedScores[eid] || 0) + sim * r
    }
  }

  // 3. Item-Based CF (Pearson)
  const itemUserMap: Record<string, Record<string, number>> = {}
  allRatings.forEach(r => {
    itemUserMap[r.ekskul_id] = itemUserMap[r.ekskul_id] || {}
    itemUserMap[r.ekskul_id][r.user_id] = r.rating
  })

  const itemBasedScores: Record<string, number> = {}
  for (const [baseEid, myR] of Object.entries(myProfile)) {
    const neighbors = itemUserMap[baseEid] || {}
    for (const [otherEid, uMap] of Object.entries(itemUserMap)) {
      if (otherEid === baseEid) continue
      const sim = pearsonSimilarity(neighbors, uMap)
      if (sim <= simThreshold) continue
      itemBasedScores[otherEid] = (itemBasedScores[otherEid] || 0) + sim * myR
    }
  }

  // 4. Agregasi ke personalScores dengan bobot 50:50
  const personalScores: Record<string, number> = {}
  const allEids = new Set([
    ...Object.keys(userBasedScores),
    ...Object.keys(itemBasedScores)
  ])
  allEids.forEach(eid => {
    const ub = userBasedScores[eid] || 0
    const ib = itemBasedScores[eid] || 0
    personalScores[eid] = ub * 0.5 + ib * 0.5
  })

  // 5. Sort dari tertinggi
  return Object.entries(personalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([ekskul_id, score]) => ({ ekskul_id, score }))
}

/**
 * Endpoint GET: untuk setiap user non-admin, hitung rekomendasi
 * – menggunakan personalScores via CF hybrid dengan Pearson.
 */
export async function GET() {
  try {
    // 1. Fetch data
    const [usersRes, ratingsRes, ekskulsRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, nama_lengkap, username, foto_url")
        .eq("is_admin", false),
      supabase.from("ratings").select("user_id, ekskul_id, rating"),
      supabase.from("ekstrakurikuler").select("id, nama, kategori"),
    ])

    if (usersRes.error || ratingsRes.error || ekskulsRes.error) {
      console.error(usersRes.error || ratingsRes.error || ekskulsRes.error)
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    }

    const users = usersRes.data!
    const allRatings = ratingsRes.data!
    const ekskuls = ekskulsRes.data!

    // 2. Untuk setiap user, hitung personalScores
    const recommendations = await Promise.all(
      users.map(async (user) => {
        const scores = await calcPersonalScores(user.id, allRatings)
        // Gabungkan dengan detail ekskul
        const recs = scores.map((r, idx) => {
          const eks = ekskuls.find(e => e.id === r.ekskul_id)
          return {
            rank: idx + 1,
            ekskul_id: r.ekskul_id,
            nama: eks?.nama,
            kategori: eks?.kategori,
            score: r.score
          }
        })
        return {
          user_id: user.id,
          nama_lengkap: user.nama_lengkap,
          username: user.username,
          foto_url: user.foto_url,
          recommendations: recs
        }
      })
    )

    // 3. Kembalikan JSON
    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Error generating recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
