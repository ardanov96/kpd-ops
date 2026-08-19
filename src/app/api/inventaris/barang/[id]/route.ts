import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET: detail 1 barang (untuk halaman detail / kartu stok)
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('barang')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH: edit barang
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params
  const body = await req.json()
  const { kategori_id, sku, nama, satuan, stok_min, harga_beli, aktif } = body

  if (nama !== undefined && (!nama || !nama.trim())) {
    return NextResponse.json({ error: 'Nama barang tidak boleh kosong' }, { status: 400 })
  }
  if (satuan !== undefined && (!satuan || !satuan.trim())) {
    return NextResponse.json({ error: 'Satuan tidak boleh kosong' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (kategori_id !== undefined) update.kategori_id = kategori_id
  if (sku !== undefined) update.sku = sku || null
  if (nama !== undefined) update.nama = nama.trim()
  if (satuan !== undefined) update.satuan = satuan.trim()
  if (stok_min !== undefined) update.stok_min = Number(stok_min) || 0
  if (harga_beli !== undefined) update.harga_beli = Number(harga_beli) || 0
  if (aktif !== undefined) update.aktif = aktif

  const { data, error } = await supabase
    .from('barang')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: soft-delete (set aktif = false) — agar history movement tetap aman
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('barang')
    .update({ aktif: false })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, barang: data })
}
