import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

async function getRekomendasiEkskul(userId: string) {
  const { data: ratings } = await supabase.from("ratings").select("*")
  const { data: responses } = await supabase.from("responses").select("*")
  const { data: questions } = await supabase.from("questions").select("id, category")
  const { data: ekskuls } = await supabase.from("ekstrakurikuler").select("*")

  if (!ratings || !responses || !questions || !ekskuls) return []

  // Question ID → category map
  const qCat: Record<number, string> = {}
  questions.forEach((q) => qCat[q.id] = q.category)

  // Build profile dari ratings + responses
  const profiles: Record<string, Record<string, number>> = {}

  ratings.forEach((r) => {
    const uid = r.user_id
    const ekskulId = r.ekskul_id
    const rate = r.rating

    profiles[uid] ??= {}
    profiles[uid][`r_${ekskulId}`] = rate
  })

  responses.forEach((r) => {
    const uid = r.user_id
    const qid = r.question_id
    const score = r.score
    const category = qCat[qid]
    if (!category) return

    profiles[uid] ??= {}
    const key = `q_${category}`
    profiles[uid][key] = (profiles[uid][key] || 0) + score
  })

  // Kategori minat user aktif
  const kategoriMinat: Record<string, number> = {}
  responses.filter((r) => r.user_id === userId).forEach((r) => {
    const kategori = qCat[r.question_id]
    if (!kategori) return
    kategoriMinat[kategori] = (kategoriMinat[kategori] || 0) + r.score
  })

  // Profil user aktif
  const myProfile = profiles[userId] ?? {}
  if (Object.keys(myProfile).length === 0) return []

  // User-based CF (dibuat kecil kontribusinya)
  const userBased: Record<string, number> = {}
  for (const [otherId, prof] of Object.entries(profiles)) {
    if (otherId === userId) continue
    const sim = cosineSimilarity(myProfile, prof)
    if (sim <= 0) continue

    ratings.filter((r) => r.user_id === otherId).forEach((r) => {
      const eid = r.ekskul_id
      const seen = ratings.some((x) => x.user_id === userId && x.ekskul_id === eid)
      if (seen) return
      userBased[eid] = (userBased[eid] || 0) + r.rating * sim
    })
  }

  // Item-based CF (kontribusi besar karena dari diri sendiri)
  const itemUser: Record<string, Record<string, number>> = {}
  ratings.forEach((r) => {
    const eid = r.ekskul_id
    const uid = r.user_id
    const rt = r.rating
    itemUser[eid] ??= {}
    itemUser[eid][uid] = rt
  })

  const myRatings = ratings.filter((r) => r.user_id === userId)
  const itemBased: Record<string, number> = {}

  myRatings.forEach((r) => {
    const eid = r.ekskul_id
    const rt = r.rating

    for (const [otherEid, uMap] of Object.entries(itemUser)) {
      if (otherEid === eid) continue
      if (myRatings.some((x) => x.ekskul_id === otherEid)) continue

      const sim = cosineSimilarity(itemUser[eid] || {}, uMap)
      if (sim <= 0) continue

      itemBased[otherEid] = (itemBased[otherEid] || 0) + sim * rt
    }
  })

  // Hitung skor akhir
  const finalScores: Record<string, number> = {}

  ekskuls.forEach((eks) => {
    const eid = eks.id
    const u = userBased[eid] || 0
    const i = itemBased[eid] || 0
    const baseScore = (u * 0.1 + i * 1.9)

    let kategoriBoost = 0
    const kategoriEkskul = eks.kategori || []
    kategoriEkskul.forEach((k: string) => {
      kategoriBoost += (kategoriMinat[k] || 0) * 0.1
    })

    let selfBoost = 0
    const myRating = myRatings.find((r) => r.ekskul_id === eid)
    if (myRating) {
      selfBoost += myRating.rating * 2.0
    }

    finalScores[eid] = baseScore + kategoriBoost + selfBoost
  })

  const sorted = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([eid, score], index) => {
      const eks = ekskuls.find((x) => x.id === eid)
      if (!eks) return null
      return {
        id: eid,
        nama: eks.nama,
        kategori: eks.kategori || [],
        skor: score,
        rank: index + 1,
      }
    })
    .filter(Boolean)

  return sorted
}

export async function GET() {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, nama_lengkap, username, foto_url")
      .eq("is_admin", false)

    if (error || !users) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    const results = []
    for (const user of users) {
      const rekomendasi = await getRekomendasiEkskul(user.id)
      results.push({
        user_id: user.id,
        nama_lengkap: user.nama_lengkap,
        username: user.username,
        foto_url: user.foto_url,
        rekomendasi,
      })
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error("Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
