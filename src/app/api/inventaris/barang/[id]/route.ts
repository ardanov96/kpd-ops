import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiNotFound, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET: detail 1 barang (auth required, staff boleh lihat outlet sendiri)
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('barang')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .eq('id', id)
    .single()

  if (error || !data) return apiNotFound('Barang tidak ditemukan')

  // Defense-in-depth: staff hanya boleh akses barang outlet sendiri
  if (profile.role !== 'owner' && profile.outlet_id && data.outlet_id !== profile.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  return apiOk(data)
}

// PATCH: edit barang (owner only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { kategori_id, sku, nama, satuan, stok_min, harga_beli, aktif } = body

  if (nama !== undefined && (!nama || !nama.trim())) {
    return apiBadRequest('Nama barang tidak boleh kosong')
  }
  if (satuan !== undefined && (!satuan || !satuan.trim())) {
    return apiBadRequest('Satuan tidak boleh kosong')
  }

  const update: Record<string, unknown> = {}
  if (kategori_id !== undefined) update.kategori_id = kategori_id
  if (sku !== undefined) update.sku = sku || null
  if (nama !== undefined) update.nama = nama.trim()
  if (satuan !== undefined) update.satuan = satuan.trim()
  if (stok_min !== undefined) update.stok_min = Number(stok_min) || 0
  if (harga_beli !== undefined) update.harga_beli = Number(harga_beli) || 0
  if (aktif !== undefined) update.aktif = aktif

  if (Object.keys(update).length === 0) {
    return apiBadRequest('Tidak ada field yang diupdate')
  }

  const admin = createAdminClient()

  // Cek outlet_id barang untuk defense-in-depth
  const { data: existing } = await admin.from('barang').select('outlet_id').eq('id', id).single()
  if (existing && profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('barang')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 500, '[PATCH barang]', 'Gagal mengupdate barang')
  return apiOk(data)
}

// DELETE: soft-delete (set aktif = false) — agar history movement tetap aman
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireOwner(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  const admin = createAdminClient()

  // Cek outlet_id barang untuk defense-in-depth
  const { data: existing } = await admin.from('barang').select('outlet_id').eq('id', id).single()
  if (existing && profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('barang')
    .update({ aktif: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 500, '[DELETE barang]', 'Gagal menonaktifkan barang')
  return apiOk({ ok: true, barang: data })
}