import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
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

  if (!barang_id) return apiBadRequest('barang_id wajib diisi')
  const q = Number(qty)
  if (!q || q <= 0) return apiBadRequest('qty harus > 0')
  const hs = Number(harga_satuan) || 0
  if (hs < 0) return apiBadRequest('harga_satuan tidak valid (negatif)')
  if (!tanggal) return apiBadRequest('tanggal wajib diisi')

  try {
    const barangRes = await query('SELECT id, outlet_id, aktif FROM barang WHERE id = $1 LIMIT 1', [barang_id])
    if (barangRes.rows.length === 0) return apiBadRequest('Barang tidak ditemukan')
    const barang = barangRes.rows[0]
    if (!barang.aktif) return apiBadRequest('Barang non-aktif, tidak bisa dicatat')

    if (profile.role !== 'owner' && profile.outlet_id !== barang.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
    }

    const total = q * hs

    const res = await query(
      `INSERT INTO stok_movement (outlet_id, barang_id, tipe, qty, harga_satuan, total, ref_type, ref_id, keterangan, tanggal, created_by)
       VALUES ($1, $2, 'IN', $3, $4, $5, 'MANUAL', null, $6, $7, $8)
       RETURNING *`,
      [barang.outlet_id, barang_id, q, hs, total, keterangan || null, tanggal, profile.id]
    )

    return apiOk(res.rows[0], 201)
  } catch (error: any) {
    return apiError(error, 500, '[POST stok-masuk]', 'Gagal mencatat stok masuk')
  }
}