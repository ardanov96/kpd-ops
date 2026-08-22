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

  // ── Validasi input ─────────────────────────────────
  if (!barang_id) return apiBadRequest('barang_id wajib diisi')
  const q = Number(qty)
  if (!q || q <= 0) return apiBadRequest('qty harus > 0')
  const hs = Number(harga_satuan) || 0
  // FIX BUG #13 (Sprint 6): harga_satuan harus > 0 untuk stok keluar
  // Sebelumnya 0 diizinkan → auto-expense jadi 0 (bug pembukuan)
  if (hs <= 0) return apiBadRequest('harga_satuan harus > 0 (untuk auto-journal expense)')
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

  // Defense-in-depth
  if (profile.role !== 'owner' && profile.outlet_id !== barang.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  // ── Cek stok cukup (via view v_stok_aktual) ────────
  const { data: stokRow, error: errStok } = await admin
    .from('v_stok_aktual')
    .select('stok')
    .eq('barang_id', barang_id)
    .single()

  const stokSekarang = Number(stokRow?.stok ?? 0)
  if (stokSekarang < q) {
    return apiBadRequest(`Stok tidak cukup. Stok saat ini: ${stokSekarang}, diminta: ${q}`)
  }

  const total = q * hs

  // ── Insert movement ────────────────────────────────
  // Trigger `trg_auto_expense_stok_out` akan auto-insert ke transaksi_keuangan
  // (sumber: INVENTARIS, kategori: 5100 Beban ATK).
  const { data, error } = await admin
    .from('stok_movement')
    .insert({
      outlet_id: barang.outlet_id,
      barang_id,
      tipe: 'OUT',
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

  if (error) return apiError(error, 500, '[POST stok-keluar]', 'Gagal mencatat stok keluar')
  return apiOk(data, 201)
}