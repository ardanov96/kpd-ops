import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// POST: manual trigger generate PPh Final 0,5% rekap (owner only)
// Body: { outlet_id, periode } -> panggil fn_generate_pph_final_rekap
// Idempotent: aman dipanggil berulang
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

  // Panggil function PG (idempotent — unique outlet+periode+jenis_pajak)
  const { data, error } = await admin.rpc('fn_generate_pph_final_rekap', {
    p_outlet_id: outlet_id,
    p_periode: periode,
  })

  if (error) return apiError(error, 500, '[POST pajak/generate-rekap]', 'Gagal generate rekap PPh')

  // Ambil row hasil generate
  const { data: rekap, error: errRekap } = await admin
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .eq('jenis_pajak', 'PPH_FINAL_05')
    .maybeSingle()

  if (errRekap) return apiError(errRekap, 500, '[POST pajak/generate-rekap]', 'Gagal memuat rekap')

  return apiOk({
    ok: true,
    rpc_result: data,
    rekap,
  })
}