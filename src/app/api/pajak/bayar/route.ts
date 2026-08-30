import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { PAJAK_STATUS } from '@/types'

export const dynamic = 'force-dynamic'

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

  try {
    const rekapRes = await query('SELECT periode, outlet_id FROM pajak_rekap WHERE id = $1 LIMIT 1', [id])
    if (rekapRes.rows.length === 0) return apiBadRequest('Rekap pajak tidak ditemukan')
    const rekap = rekapRes.rows[0]

    const closingRes = await query(
      'SELECT is_locked FROM periode_closing WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [rekap.outlet_id, rekap.periode]
    )

    if (closingRes.rows[0]?.is_locked) {
      return NextResponse.json(
        {
          error: `Periode ${rekap.periode} sudah di-closing (locked). Tidak bisa mengubah rekap pajak.`,
        },
        { status: 403 }
      )
    }

    const updates: string[] = ['status_bayar = $1']
    const values: any[] = [status_bayar]

    if (tanggal_bayar !== undefined) {
      values.push(tanggal_bayar || null)
      updates.push(`tanggal_bayar = $${values.length}`)
    }
    if (bukti_url !== undefined) {
      values.push(bukti_url || null)
      updates.push(`bukti_url = $${values.length}`)
    }
    if (catatan !== undefined) {
      values.push(catatan || null)
      updates.push(`catatan = $${values.length}`)
    }

    values.push(id)
    const res = await query(
      `UPDATE pajak_rekap SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )

    return apiOk(res.rows[0])
  } catch (error: any) {
    return apiError(error, 500, '[POST pajak/bayar]', 'Gagal mengupdate status bayar')
  }
}