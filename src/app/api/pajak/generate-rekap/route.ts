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
  const { outlet_id, periode } = body

  if (!outlet_id) return apiBadRequest('outlet_id wajib')
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return apiBadRequest('periode harus YYYY-MM')
  }

  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  try {
    const rpcRes = await query('SELECT fn_generate_pph_final_rekap($1, $2)', [outlet_id, periode])

    const res = await query(
      'SELECT * FROM pajak_rekap WHERE outlet_id = $1 AND periode = $2 AND jenis_pajak = \'PPH_FINAL_05\' LIMIT 1',
      [outlet_id, periode]
    )

    return apiOk({
      ok: true,
      rpc_result: rpcRes.rows[0],
      rekap: res.rows[0] || null,
    })
  } catch (error: any) {
    return apiError(error, 500, '[POST pajak/generate-rekap]', 'Gagal generate rekap PPh')
  }
}