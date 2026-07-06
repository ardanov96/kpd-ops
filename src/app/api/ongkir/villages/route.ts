import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const districtCode = req.nextUrl.searchParams.get('district_code') || ''

  // Mode 1: pilih kecamatan -> list semua kelurahan di dalamnya
  if (districtCode) {
    const res = await fetch(
      `https://use.api.co.id/regional/indonesia/villages?district_code=${encodeURIComponent(districtCode)}&limit=100`,
      { headers: { 'x-api-co-id': process.env.APICOOID_KEY! } }
    )
    const data = await res.json()
    const items: any[] = data?.data || []

    const mapped = items.map((item: any) => ({
      village_code: item.code || '',
      village: item.name || '',
      district: item.district || '',
      city: item.regency || '',
      province: item.province || '',
    }))

    return NextResponse.json(mapped)
  }

  // Mode 2: cari kecamatan berdasarkan nama
  if (q.length < 3) return NextResponse.json([])

  const res = await fetch(
    `https://use.api.co.id/regional/indonesia/districts?name=${encodeURIComponent(q)}&limit=10`,
    { headers: { 'x-api-co-id': process.env.APICOOID_KEY! } }
  )
  const data = await res.json()
  const items: any[] = data?.data || []

  const mapped = items.map((item: any) => ({
    district_code: item.code || '',
    district: item.name || '',
    city: item.regency_name || item.regency || '',
    province: item.province_name || item.province || '',
  }))

  return NextResponse.json(mapped)
}
