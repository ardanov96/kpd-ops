import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { FORM_SPT_OPTIONS, METODE_PPH_OPTIONS } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  if (!outletId) return apiBadRequest('outlet_id wajib')

  try {
    const res = await query('SELECT * FROM pajak_config WHERE outlet_id = $1 LIMIT 1', [outletId])
    return apiOk(res.rows[0] || null)
  } catch (error: any) {
    return apiError(error, 500, '[GET pajak/config]', 'Gagal memuat config pajak')
  }
}

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

  try {
    const cleanNpwp = npwp ? String(npwp).replace(/\D/g, '') : null
    const res = await query(
      `INSERT INTO pajak_config (outlet_id, npwp, nama_wp, metode_pph, pkp, omzet_tahunan, form_spt, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (outlet_id) DO UPDATE SET
         npwp = EXCLUDED.npwp,
         nama_wp = EXCLUDED.nama_wp,
         metode_pph = EXCLUDED.metode_pph,
         pkp = EXCLUDED.pkp,
         omzet_tahunan = EXCLUDED.omzet_tahunan,
         form_spt = EXCLUDED.form_spt,
         updated_at = NOW()
       RETURNING *`,
      [
        outlet_id, cleanNpwp, nama_wp || null, metode_pph || 'FINAL_05',
        pkp === true, Number(omzet_tahunan) || 0, form_spt || '1770S3'
      ]
    )
    return apiOk(res.rows[0])
  } catch (error: any) {
    return apiError(error, 500, '[POST pajak/config]', 'Gagal menyimpan config pajak')
  }
}