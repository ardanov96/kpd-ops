import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await query('SELECT * FROM kurir ORDER BY nama ASC')
    return NextResponse.json(res.rows, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch kurir' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nama, kode, warna, telepon, portal_url, keterangan } = body
    if (!nama || !kode) return NextResponse.json({ error: 'Nama dan kode wajib diisi' }, { status: 400 })

    const res = await query(
      `INSERT INTO kurir (nama, kode, warna, telepon, portal_url, keterangan, aktif)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [nama, kode.toUpperCase(), warna || '#f97316', telepon || null, portal_url || null, keterangan || null]
    )

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create kurir' }, { status: 500 })
  }
}