import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiNotFound, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  try {
    const res = await query(
      `SELECT b.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
       FROM barang b
       LEFT JOIN kategori_inventaris k ON k.id = b.kategori_id
       WHERE b.id = $1 LIMIT 1`,
      [id]
    )

    if (res.rows.length === 0) return apiNotFound('Barang tidak ditemukan')
    const data = res.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id && data.outlet_id !== profile.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    return apiOk(data)
  } catch (error: any) {
    return apiError(error, 500, '[GET barang/id]', 'Gagal mengambil detail barang')
  }
}

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

  try {
    const existingRes = await query('SELECT outlet_id FROM barang WHERE id = $1 LIMIT 1', [id])
    if (existingRes.rows.length === 0) return apiNotFound('Barang tidak ditemukan')
    const existing = existingRes.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (kategori_id !== undefined) { values.push(kategori_id); updates.push(`kategori_id = $${values.length}`) }
    if (sku !== undefined) { values.push(sku || null); updates.push(`sku = $${values.length}`) }
    if (nama !== undefined) { values.push(nama.trim()); updates.push(`nama = $${values.length}`) }
    if (satuan !== undefined) { values.push(satuan.trim()); updates.push(`satuan = $${values.length}`) }
    if (stok_min !== undefined) { values.push(Number(stok_min) || 0); updates.push(`stok_min = $${values.length}`) }
    if (harga_beli !== undefined) { values.push(Number(harga_beli) || 0); updates.push(`harga_beli = $${values.length}`) }
    if (aktif !== undefined) { values.push(Boolean(aktif)); updates.push(`aktif = $${values.length}`) }

    if (updates.length === 0) return apiBadRequest('Tidak ada field yang diupdate')

    values.push(id)
    const res = await query(
      `UPDATE barang SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )
    return apiOk(res.rows[0])
  } catch (error: any) {
    return apiError(error, 500, '[PATCH barang/id]', 'Gagal mengupdate barang')
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireOwner(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  try {
    const existingRes = await query('SELECT outlet_id FROM barang WHERE id = $1 LIMIT 1', [id])
    if (existingRes.rows.length === 0) return apiNotFound('Barang tidak ditemukan')
    const existing = existingRes.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const res = await query('UPDATE barang SET aktif = false WHERE id = $1 RETURNING *', [id])
    return apiOk({ ok: true, barang: res.rows[0] })
  } catch (error: any) {
    return apiError(error, 500, '[DELETE barang/id]', 'Gagal menonaktifkan barang')
  }
}