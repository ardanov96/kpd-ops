import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: tambah template recurring
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, nama_template, kategori_id, tipe, nominal, metode, tanggal_setiap_bulan, aktif } = body

  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })
  if (!nama_template || !nama_template.trim()) return NextResponse.json({ error: 'nama_template wajib' }, { status: 400 })
  if (!kategori_id) return NextResponse.json({ error: 'kategori_id wajib' }, { status: 400 })
  if (!['MASUK', 'KELUAR'].includes(tipe)) return NextResponse.json({ error: 'tipe harus MASUK/KELUAR' }, { status: 400 })
  const n = Number(nominal)
  if (!n || n <= 0) return NextResponse.json({ error: 'nominal harus > 0' }, { status: 400 })
  const tgl = Number(tanggal_setiap_bulan)
  if (!Number.isInteger(tgl) || tgl < 1 || tgl > 31) {
    return NextResponse.json({ error: 'tanggal_setiap_bulan harus 1-31' }, { status: 400 })
  }
  if (metode && !['CASH', 'BANK', 'EWALLET'].includes(metode)) {
    return NextResponse.json({ error: 'metode tidak valid' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      outlet_id,
      nama_template: nama_template.trim(),
      kategori_id,
      tipe,
      nominal: n,
      metode: metode || null,
      tanggal_setiap_bulan: tgl,
      aktif: aktif !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET: list template per outlet
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  let query = supabase
    .from('recurring_transactions')
    .select('*, kategori:kategori_akun(kode, nama)')
    .order('aktif', { ascending: false })
    .order('tanggal_setiap_bulan')

  if (outletId) query = query.eq('outlet_id', outletId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
