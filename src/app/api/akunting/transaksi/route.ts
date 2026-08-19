import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: tambah transaksi keuangan manual
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, tanggal, tipe, kategori_id, nominal, metode, keterangan } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib diisi' }, { status: 400 })
  if (!tanggal) return NextResponse.json({ error: 'tanggal wajib diisi' }, { status: 400 })
  if (!['MASUK', 'KELUAR', 'TRANSFER'].includes(tipe)) {
    return NextResponse.json({ error: 'tipe harus MASUK/KELUAR/TRANSFER' }, { status: 400 })
  }
  if (!kategori_id) return NextResponse.json({ error: 'kategori_id wajib diisi' }, { status: 400 })
  const n = Number(nominal)
  if (!n || n <= 0) return NextResponse.json({ error: 'nominal harus > 0' }, { status: 400 })
  if (metode && !['CASH', 'BANK', 'EWALLET'].includes(metode)) {
    return NextResponse.json({ error: 'metode tidak valid' }, { status: 400 })
  }

  // ── Cek kategori sesuai tipe ───────────────────────
  const { data: kat, error: errKat } = await supabase
    .from('kategori_akun')
    .select('id, tipe')
    .eq('id', kategori_id)
    .single()

  if (errKat || !kat) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })

  const expectedTipe = tipe === 'MASUK' ? 'INCOME' : tipe === 'KELUAR' ? 'EXPENSE' : null
  if (expectedTipe && kat.tipe !== expectedTipe && kat.tipe !== 'ASSET' && kat.tipe !== 'LIABILITY' && kat.tipe !== 'EQUITY') {
    return NextResponse.json({
      error: `Kategori ${kat.tipe} tidak cocok dengan tipe transaksi ${tipe}`,
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transaksi_keuangan')
    .insert({
      outlet_id,
      tanggal,
      tipe,
      kategori_id,
      sumber: 'MANUAL',
      nominal: n,
      metode: metode || null,
      keterangan: keterangan || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET: list transaksi (filter by outlet)
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const periode = searchParams.get('periode')

  let query = supabase
    .from('transaksi_keuangan')
    .select('*, kategori:kategori_akun(kode, nama, tipe)')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (outletId) query = query.eq('outlet_id', outletId)
  if (periode) {
    // periode = YYYY-MM
    const start = `${periode}-01`
    const [y, m] = periode.split('-').map(Number)
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    query = query.gte('tanggal', start).lt('tanggal', nextMonth)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
