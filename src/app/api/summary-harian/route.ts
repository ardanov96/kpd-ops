import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get('tanggal')
    const range = Number(searchParams.get('range') || '30')
    const kurirKode = searchParams.get('kurir')

    let sql = 'SELECT * FROM v_summary_harian WHERE 1=1'
    const params: any[] = []

    if (tanggal) {
      params.push(tanggal)
      sql += ` AND tanggal = $${params.length}`
    }
    if (kurirKode) {
      params.push(kurirKode)
      sql += ` AND kurir_kode = $${params.length}`
    }

    params.push(range)
    sql += ` ORDER BY tanggal DESC LIMIT $${params.length}`

    const res = await query(sql, params)
    return NextResponse.json(res.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch daily summary' }, { status: 500 })
  }
}