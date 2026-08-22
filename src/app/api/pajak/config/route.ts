import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { FORM_SPT_OPTIONS, METODE_PPH_OPTIONS } from '@/types'

export const dynamic = 'force-dynamic'

// GET: ambil pajak_config untuk outlet (owner only — data NPWP sensitif per D-006)
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  if (!outletId) return apiBadRequest('outlet_id wajib')

  const { data, error } = await admin
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outletId)
    .maybeSingle()

  if (error) return apiError(error, 500, '[GET pajak/config]', 'Gagal memuat config pajak')
  return apiOk(data || null)
}

// POST: upsert pajak_config (owner only)
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { outlet_id, npwp, nama_wp, metode_pph, pkp, omzet_tahunan, form_spt } = body

  if (!outlet_id) return apiBadRequest('outlet_id wajib')

  // Validasi NPWP format (15 digit)
  if (npwp !== undefined && npwp !== null && npwp !== '') {
    const cleaned = String(npwp).replace(/\D/g, '')
    if (cleaned.length !== 15) {
      return apiBadRequest('NPWP harus 15 digit angka')
    }
  }

  if (form_spt && !FORM_SPT_OPTIONS.includes(form_spt)) {
    return apiBadRequest(`form_spt harus salah satu dari: ${FORM_SPT_OPTIONS.join(', ')}`)
  }
  if (metode_pph && !METODE_PPH_OPTIONS.includes(metode_pph)) {
    return apiBadRequest(`metode_pph harus salah satu dari: ${METODE_PPH_OPTIONS.join(', ')}`)
  }

  const admin = createAdminClient()

  // Upsert (insert or update by outlet_id primary key)
  const payload: Record<string, unknown> = {
    outlet_id,
    npwp: npwp ? String(npwp).replace(/\D/g, '') : null,
    nama_wp: nama_wp || null,
    metode_pph: metode_pph || 'FINAL_05',
    pkp: pkp === true,
    omzet_tahunan: Number(omzet_tahunan) || 0,
    form_spt: form_spt || '1770S3',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('pajak_config')
    .upsert(payload, { onConflict: 'outlet_id' })
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST pajak/config]', 'Gagal menyimpan config pajak')
  return apiOk(data)
}