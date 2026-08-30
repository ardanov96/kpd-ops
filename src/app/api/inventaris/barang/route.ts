import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const guard = await requireAuth(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  try {
    let sql = `
      SELECT b.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
      FROM barang b
      LEFT JOIN kategori_inventaris k ON k.id = b.kategori_id
    `
    const params: any[] = []

    if (profile.role !== 'owner' && profile.outlet_id) {
      params.push(profile.outlet_id)
      sql += ` WHERE b.outlet_id = $${params.length}`
    }

    sql += ' ORDER BY b.nama ASC'

    const res = await query(sql, params)
    return apiOk(res.rows)
  } catch (error: any) {
    return apiError(error, 500, '[GET barang]', 'Gagal memuat daftar barang')
  }
}

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

  if (!outlet_id) return apiBadRequest('outlet_id wajib diisi')
  if (!kategori_id) return apiBadRequest('kategori_id wajib diisi')
  if (!nama || !nama.trim()) return apiBadRequest('Nama barang wajib diisi')
  if (!satuan || !satuan.trim()) return apiBadRequest('Satuan wajib diisi')

  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  try {
    const res = await query(
      `INSERT INTO barang (outlet_id, kategori_id, sku, nama, satuan, stok_min, harga_beli, aktif)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        outlet_id, kategori_id, sku || null, nama.trim(), satuan.trim(),
        Number(stok_min) || 0, Number(harga_beli) || 0, aktif !== false
      ]
    )
    return apiOk(res.rows[0], 201)
  } catch (error: any) {
    return apiError(error, 500, '[POST barang]', 'Gagal menambah barang')
  }
}