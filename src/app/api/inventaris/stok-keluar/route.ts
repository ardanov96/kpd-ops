import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

/**
 * Sprint 6 - Fix BUG #13 (lengkap):
 *   Panggil RPC `fn_stok_keluar_atomic` yang:
 *   - Lock row barang (FOR UPDATE) → anti race condition
 *   - Cek stok + insert movement dalam 1 transaction
 *   - Trigger auto-expense tetap jalan AFTER insert
 *   - Return stok sebelum & sesudah untuk UI feedback
 *
 *   Lihat migration: supabase/migrations/012_stok_keluar_atomic.sql
 */
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

  // ── Validasi input ─────────────────────────────────
  if (!barang_id) return apiBadRequest('barang_id wajib diisi')
  const q = Number(qty)
  if (!q || q <= 0) return apiBadRequest('qty harus > 0')
  const hs = Number(harga_satuan) || 0
  if (hs <= 0) return apiBadRequest('harga_satuan harus > 0 (untuk auto-journal expense)')
  if (!tanggal) return apiBadRequest('tanggal wajib diisi')

  const admin = createAdminClient()

  // Defense-in-depth: cek outlet_id barang sebelum panggil RPC
  const { data: barang } = await admin
    .from('barang')
    .select('outlet_id')
    .eq('id', barang_id)
    .single()

  if (barang && profile.role !== 'owner' && profile.outlet_id !== barang.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  // Panggil atomic RPC function (auto-handle race condition & validasi)
  const { data, error } = await admin.rpc('fn_stok_keluar_atomic', {
    p_barang_id: barang_id,
    p_qty: q,
    p_harga_satuan: hs,
    p_tanggal: tanggal,
    p_keterangan: keterangan || null,
  })

  if (error) {
    // Translate error Supabase jadi pesan user-friendly
    const msg = error.message || ''
    if (msg.includes('Stok tidak cukup')) {
      return apiBadRequest(msg.replace(/^ERROR: /, ''))
    }
    if (msg.includes('qty harus')) {
      return apiBadRequest(msg.replace(/^ERROR: /, ''))
    }
    if (msg.includes('harga_satuan harus')) {
      return apiBadRequest(msg.replace(/^ERROR: /, ''))
    }
    if (msg.includes('Barang tidak ditemukan')) {
      return apiBadRequest('Barang tidak ditemukan')
    }
    if (msg.includes('Barang non-aktif')) {
      return apiBadRequest('Barang non-aktif, tidak bisa dicatat')
    }
    return apiError(error, 500, '[POST stok-keluar]', 'Gagal mencatat stok keluar')
  }

  // Ambil hasil movement_id + stok info
  const result = Array.isArray(data) && data.length > 0 ? data[0] : data
  const movementId = (result as any)?.movement_id
  const stokSebelum = (result as any)?.stok_sebelum
  const stokSesudah = (result as any)?.stok_sesudah
  const total = (result as any)?.total

  return apiOk({
    ok: true,
    movement_id: movementId,
    stok_sebelum: Number(stokSebelum),
    stok_sesudah: Number(stokSesudah),
    total: Number(total),
  })
}