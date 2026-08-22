import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

type Item = {
  barang_id: string
  qty_sistem: number
  qty_fisik: number
  selisih: number
  harga_satuan?: number
  catatan?: string | null
}

type Body = {
  outlet_id: string
  periode: string
  tanggal_opname: string
  catatan?: string | null
  items: Item[]
}

/**
 * Sprint 6 - Fix BUG #14: Type safety
 * Explicit return type untuk fn_save_opname_atomic
 */
interface OpnameAtomicResult {
  opname_id: string
  items_count: number
  adj_count: number
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  let body: Body
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { outlet_id, periode, tanggal_opname, catatan, items } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return apiBadRequest('outlet_id wajib diisi')
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return apiBadRequest('periode harus format YYYY-MM')
  }
  if (!tanggal_opname) return apiBadRequest('tanggal_opname wajib diisi')
  if (!Array.isArray(items) || items.length === 0) {
    return apiBadRequest('items tidak boleh kosong')
  }

  // Defense-in-depth
  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  const admin = createAdminClient()

  // ── Cek apakah opname periode ini sudah FINAL ──────
  const { data: existing } = await admin
    .from('opname')
    .select('id, status')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .maybeSingle()

  if (existing && existing.status === 'FINAL') {
    return apiBadRequest('Opname periode ini sudah FINAL. Tidak bisa diubah lagi.')
  }

  // ── Atomic via RPC function (Fix Bug #2) ───────────
  // RPC function `fn_save_opname_atomic` jalan di Postgres sebagai 1 transaction.
  // Kalau ada error di tengah → ROLLBACK semua (header, items, ADJ movements).
  // Lihat migration `supabase/migrations/007_opname_atomic.sql`.
  const { data, error } = await admin.rpc('fn_save_opname_atomic', {
    p_outlet_id: outlet_id,
    p_periode: periode,
    p_tanggal_opname: tanggal_opname,
    p_catatan: catatan || null,
    p_items: items.map((it) => ({
      barang_id: it.barang_id,
      qty_sistem: Number(it.qty_sistem) || 0,
      qty_fisik: Number(it.qty_fisik) || 0,
      selisih: Number(it.selisih) || 0,
      harga_satuan: Number(it.harga_satuan) || 0,
      catatan: it.catatan || null,
    })),
  })

  if (error) {
    return apiError(
      error,
      500,
      '[POST opname]',
      `Gagal menyimpan opname: ${error.message}. Coba lagi atau hubungi admin.`
    )
  }

  // FIX BUG #14 (Sprint 6): Type safety — tidak pakai 'as any'
  const result = Array.isArray(data) && data.length > 0 ? data[0] : data
  const rpcResult = result as OpnameAtomicResult | null

  if (!rpcResult || !rpcResult.opname_id) {
    return apiError(
      new Error('RPC tidak mengembalikan opname_id'),
      500,
      '[POST opname]',
      'Gagal menyimpan opname (response kosong).'
    )
  }

  return apiOk({
    ok: true,
    opname_id: rpcResult.opname_id,
    items_count: rpcResult.items_count,
    adj_count: rpcResult.adj_count,
  })
}