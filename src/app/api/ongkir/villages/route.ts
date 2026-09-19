import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://use.api.co.id'
const API_KEY = process.env.APICOOID_KEY || ''

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({
      error: 'APICOOID_KEY belum diset di .env.local. Daftar di https://use.api.co.id utk mendapatkan API key.',
    }, { status: 503 })
  }

  const q = req.nextUrl.searchParams.get('q') || ''
  const districtCode = req.nextUrl.searchParams.get('district_code') || ''

  // Mode 1: pilih kecamatan -> list semua kelurahan di dalamnya
  if (districtCode) {
    const res = await fetch(
      `${BASE_URL}/regional/indonesia/villages?district_code=${encodeURIComponent(districtCode)}&limit=100`,
      { headers: { 'x-api-co-id': API_KEY } }
    )
    const data = await res.json().catch(() => null)
    if (!data?.is_success) {
      return NextResponse.json({
        error: `Gagal ambil kelurahan: ${data?.message || `HTTP ${res.status}`}`,
      }, { status: 502 })
    }
    const items: any[] = data.data || []
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
    `${BASE_URL}/regional/indonesia/districts?name=${encodeURIComponent(q)}&limit=10`,
    { headers: { 'x-api-co-id': API_KEY } }
  )
  const data = await res.json().catch(() => null)
  if (!data?.is_success) {
    return NextResponse.json({
      error: `Gagal cari kecamatan: ${data?.message || `HTTP ${res.status}`}`,
    }, { status: 502 })
  }

  const items: any[] = data.data || []
  const mapped = items.map((item: any) => ({
    district_code: item.code || '',
    district: item.name || '',
    city: item.regency_name || item.regency || '',
    province: item.province_name || item.province || '',
  }))

  return NextResponse.json(mapped)
}
