import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (q.length < 3) return NextResponse.json([])

  const res = await fetch(
    `https://use.api.co.id/regional/indonesia/villages?name=${encodeURIComponent(q)}&limit=10`,
    { headers: { 'x-api-co-id': process.env.APICOOID_KEY! } }
  )
  const data = await res.json()

  // Log untuk debug — lihat di terminal Next.js
  console.log('Villages raw:', JSON.stringify(data).slice(0, 600))

  const items: any[] = data?.data || []

  const mapped = items.map((item: any) => ({
    village_code: item.village_code || item.code || item.id || '',
    village: item.village || item.name || item.village_name || '',
    district: item.district || item.district_name || '',
    city: item.city || item.city_name || item.regency || item.regency_name || '',
    province: item.province || item.province_name || '',
  }))

  return NextResponse.json(mapped)
}