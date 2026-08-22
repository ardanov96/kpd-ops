import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// GET: list rekap pajak (owner only — data NPWP & nilai PPh sensitif per D-006)
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const periode = searchParams.get('periode')

  // Defense-in-depth
  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) return NextResponse.json([], { status: 200 })
    effectiveOutletId = profile.outlet_id
  }

  let query = admin
    .from('pajak_rekap')
    .select('*')
    .order('periode', { ascending: false })
    .limit(60)

  if (effectiveOutletId) query = query.eq('outlet_id', effectiveOutletId)
  if (periode) query = query.eq('periode', periode)

  const { data, error } = await query
  if (error) return apiError(error, 500, '[GET pajak/rekap]', 'Gagal memuat rekap pajak')
  return apiOk(data || [])
}