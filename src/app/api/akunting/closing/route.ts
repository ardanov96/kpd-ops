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
    await query('SELECT fn_closing_periode($1, $2, $3)', [outlet_id, periode, profile.id])

    const res = await query(
      'SELECT * FROM periode_closing WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet_id, periode]
    )

    const closing = res.rows[0]

    return apiOk({
      ok: true,
      closing,
      laba: closing?.laba,
      total_income: closing?.total_income,
      total_expense: closing?.total_expense,
    })
  } catch (error: any) {
    return apiError(error, 500, '[POST closing]', 'Gagal menutup periode')
  }
}