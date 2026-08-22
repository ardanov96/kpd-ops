import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { barang_id, qty, harga_satuan, tanggal, keterangan } = body

  // ── Validasi ───────────────────────────────────────
  if (!barang_id) return apiBadRequest('barang_id wajib diisi')
  const q = Number(qty)
  if (!q || q <= 0) return apiBadRequest('qty harus > 0')
  const hs = Number(harga_satuan) || 0
  if (hs < 0) return apiBadRequest('harga_satuan tidak valid (negatif)')
  if (!tanggal) return apiBadRequest('tanggal wajib diisi')

  const admin = createAdminClient()

  // ── Cek barang exists & aktif ──────────────────────
  const { data: barang, error: errBarang } = await admin
    .from('barang')
    .select('id, outlet_id, aktif')
    .eq('id', barang_id)
    .single()

  if (errBarang || !barang) return apiBadRequest('Barang tidak ditemukan')
  if (!barang.aktif) return apiBadRequest('Barang non-aktif, tidak bisa dicatat')

  // Defense-in-depth: staff tidak boleh akses outlet lain
  if (profile.role !== 'owner' && profile.outlet_id !== barang.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  const total = q * hs

  // ── Insert movement ────────────────────────────────
  const { data, error } = await admin
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
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST stok-masuk]', 'Gagal mencatat stok masuk')
  return apiOk(data, 201)
}