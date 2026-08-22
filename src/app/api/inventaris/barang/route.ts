import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// GET: list barang (auth required, staff boleh akses outlet sendiri)
export async function GET(_req: NextRequest) {
  const guard = await requireAuth(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const admin = createAdminClient()
  let query = admin
    .from('barang')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .order('nama')

  // Staff hanya lihat barang outlet sendiri
  if (profile.role !== 'owner' && profile.outlet_id) {
    query = query.eq('outlet_id', profile.outlet_id)
  }

  const { data, error } = await query
  if (error) return apiError(error, 500, '[GET barang]', 'Gagal memuat daftar barang')
  return apiOk(data || [])
}

// POST: tambah barang baru (owner only)
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
  const { outlet_id, kategori_id, sku, nama, satuan, stok_min, harga_beli, aktif } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return apiBadRequest('outlet_id wajib diisi')
  if (!kategori_id) return apiBadRequest('kategori_id wajib diisi')
  if (!nama || !nama.trim()) return apiBadRequest('Nama barang wajib diisi')
  if (!satuan || !satuan.trim()) return apiBadRequest('Satuan wajib diisi')

  // Defense-in-depth
  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
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
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST barang]', 'Gagal menambah barang')
  return apiOk(data, 201)
}