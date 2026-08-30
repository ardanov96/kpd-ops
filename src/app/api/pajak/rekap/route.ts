import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const periode = searchParams.get('periode')

  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) return NextResponse.json([], { status: 200 })
    effectiveOutletId = profile.outlet_id
  }

  try {
    let sql = 'SELECT * FROM pajak_rekap WHERE 1=1'
    const params: any[] = []

    if (effectiveOutletId) {
      params.push(effectiveOutletId)
      sql += ` AND outlet_id = $${params.length}`
    }
    if (periode) {
      params.push(periode)
      sql += ` AND periode = $${params.length}`
    }

    sql += ' ORDER BY periode DESC LIMIT 60'

    const res = await query(sql, params)
    return apiOk(res.rows)
  } catch (error: any) {
    return apiError(error, 500, '[GET pajak/rekap]', 'Gagal memuat rekap pajak')
  }
}