import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// POST: tutup buku & lock periode (idempotent — bisa re-run untuk hitung ulang) (owner only)
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
  const { outlet_id, periode } = body

  if (!outlet_id) return apiBadRequest('outlet_id wajib')
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return apiBadRequest('periode harus YYYY-MM')
  }

  // Defense-in-depth
  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Panggil function fn_closing_periode (idempotent) — Sprint 6: pass profile.id as closed_by
  const { error: fnErr } = await admin.rpc('fn_closing_periode', {
    p_outlet_id: outlet_id,
    p_periode: periode,
    p_closed_by: profile.id,
  })

  if (fnErr) return apiError(fnErr, 500, '[POST closing]', 'Gagal menutup periode')

  // Ambil hasil closing
  const { data: closing, error: errCl } = await admin
    .from('periode_closing')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .single()

  if (errCl) return apiError(errCl, 500, '[POST closing]', 'Gagal memuat hasil closing')

  return apiOk({
    ok: true,
    closing,
    laba: closing?.laba,
    total_income: closing?.total_income,
    total_expense: closing?.total_expense,
  })
}