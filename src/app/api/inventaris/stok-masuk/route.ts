import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { barang_id, qty, harga_satuan, tanggal, keterangan } = body

  // ── Validasi ───────────────────────────────────────
  if (!barang_id) return NextResponse.json({ error: 'barang_id wajib diisi' }, { status: 400 })
  const q = Number(qty)
  if (!q || q <= 0) return NextResponse.json({ error: 'qty harus > 0' }, { status: 400 })
  const hs = Number(harga_satuan) || 0
  if (hs < 0) return NextResponse.json({ error: 'harga_satuan tidak valid' }, { status: 400 })
  if (!tanggal) return NextResponse.json({ error: 'tanggal wajib diisi' }, { status: 400 })

  // ── Cek barang exists & aktif ──────────────────────
  const { data: barang, error: errBarang } = await supabase
    .from('barang')
    .select('id, outlet_id, aktif')
    .eq('id', barang_id)
    .single()

  if (errBarang || !barang) return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 })
  if (!barang.aktif) return NextResponse.json({ error: 'Barang non-aktif, tidak bisa dicatat' }, { status: 400 })

  const total = q * hs

  // ── Insert movement ────────────────────────────────
  const { data, error } = await supabase
    .from('stok_movement')
    .insert({
      outlet_id: barang.outlet_id,
      barang_id,
      tipe: 'IN',
      qty: q,
      harga_satuan: hs,
      total,
      ref_type: 'MANUAL',
      ref_id: null,
      keterangan: keterangan || null,
      tanggal,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
