import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const tanggal = searchParams.get('tanggal') // YYYY-MM-DD (optional)
  const range = searchParams.get('range') || '30' // default 30 hari terakhir
  const kurirKode = searchParams.get('kurir') // optional filter

  let query = supabase
    .from('v_summary_harian')
    .select('*')
    .order('tanggal', { ascending: false })
    .limit(Number(range))

  if (tanggal) query = query.eq('tanggal', tanggal)
  if (kurirKode) query = query.eq('kurir_kode', kurirKode)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}