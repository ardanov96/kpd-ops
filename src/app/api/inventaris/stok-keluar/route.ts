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
  if (hs <= 0) return apiBadRequest('harga_satuan harus > 0 (untuk auto-journal expense)')
  if (!tanggal) return apiBadRequest('tanggal wajib diisi')

  try {
    const barangRes = await query('SELECT outlet_id FROM barang WHERE id = $1 LIMIT 1', [barang_id])
    if (barangRes.rows.length === 0) return apiBadRequest('Barang tidak ditemukan')
    const barang = barangRes.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id !== barang.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
    }

    const rpcRes = await query(
      'SELECT * FROM fn_stok_keluar_atomic($1, $2, $3, $4, $5)',
      [barang_id, q, hs, tanggal, keterangan || null]
    )

    const result = rpcRes.rows[0]

    return apiOk({
      ok: true,
      movement_id: result?.movement_id,
      stok_sebelum: Number(result?.stok_sebelum),
      stok_sesudah: Number(result?.stok_sesudah),
      total: Number(result?.total),
    })
  } catch (error: any) {
    const msg = error?.message || ''
    if (msg.includes('Stok tidak cukup') || msg.includes('qty harus') || msg.includes('harga_satuan harus') || msg.includes('Barang non-aktif')) {
      return apiBadRequest(msg)
    }
    return apiError(error, 500, '[POST stok-keluar]', 'Gagal mencatat stok keluar')
  }
}