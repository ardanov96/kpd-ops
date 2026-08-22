import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { PAJAK_STATUS } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST: set status LUNAS + tanggal_bayar + bukti_url
 * Body: { id, status_bayar: 'BELUM'|'LUNAS'|'BEAS', tanggal_bayar, bukti_url, catatan }
 *
 * FIX ISU #31 (Sprint 6): Validasi periode tidak di-closing.
 * Sebelumnya: owner bisa edit rekap bulan yang sudah closing → pembukuan bisa dimanipulasi.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { id, status_bayar, tanggal_bayar, bukti_url, catatan } = body

  if (!id) return apiBadRequest('id rekap wajib')
  if (!PAJAK_STATUS.includes(status_bayar)) {
    return apiBadRequest(`status_bayar harus salah satu dari: ${PAJAK_STATUS.join(', ')}`)
  }

  const admin = createAdminClient()

  // FIX ISU #31: Cek apakah periode sudah di-closing
  // Ambil rekap dulu untuk tau periode
  const { data: rekap, error: errRekap } = await admin
    .from('pajak_rekap')
    .select('periode, outlet_id')
    .eq('id', id)
    .single()

  if (errRekap || !rekap) return apiBadRequest('Rekap pajak tidak ditemukan')

  // Cek periode_closing
  const { data: closing } = await admin
    .from('periode_closing')
    .select('is_locked')
    .eq('outlet_id', rekap.outlet_id)
    .eq('periode', rekap.periode)
    .maybeSingle()

  if (closing?.is_locked) {
    return NextResponse.json(
      {
        error: `Periode ${rekap.periode} sudah di-closing (locked). Tidak bisa mengubah rekap pajak.`,
      },
      { status: 403 }
    )
  }

  const payload: Record<string, unknown> = { status_bayar }
  if (tanggal_bayar !== undefined) payload.tanggal_bayar = tanggal_bayar || null
  if (bukti_url !== undefined) payload.bukti_url = bukti_url || null
  if (catatan !== undefined) payload.catatan = catatan || null

  const { data, error } = await admin
    .from('pajak_rekap')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST pajak/bayar]', 'Gagal mengupdate status bayar')
  return apiOk(data)
}