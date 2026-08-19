import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: list barang (untuk debugging / reuse)
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('barang')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .order('nama')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST: tambah barang baru
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, kategori_id, sku, nama, satuan, stok_min, harga_beli, aktif } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib diisi' }, { status: 400 })
  if (!kategori_id) return NextResponse.json({ error: 'kategori_id wajib diisi' }, { status: 400 })
  if (!nama || !nama.trim()) return NextResponse.json({ error: 'Nama barang wajib diisi' }, { status: 400 })
  if (!satuan || !satuan.trim()) return NextResponse.json({ error: 'Satuan wajib diisi' }, { status: 400 })

  const { data, error } = await supabase
    .from('barang')
    .insert({
      outlet_id,
      kategori_id,
      sku: sku || null,
      nama: nama.trim(),
      satuan: satuan.trim(),
      stok_min: Number(stok_min) || 0,
      harga_beli: Number(harga_beli) || 0,
      aktif: aktif !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
