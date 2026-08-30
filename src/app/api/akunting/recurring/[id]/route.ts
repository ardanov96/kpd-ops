import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { METODE_PEMBAYARAN } from '@/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }

  const updates: string[] = []
  const values: any[] = []

  if (body.nama_template !== undefined) {
    if (!body.nama_template || !body.nama_template.trim()) {
      return apiBadRequest('nama_template wajib diisi')
    }
    values.push(body.nama_template.trim())
    updates.push(`nama_template = $${values.length}`)
  }
  if (body.kategori_id !== undefined) {
    values.push(body.kategori_id)
    updates.push(`kategori_id = $${values.length}`)
  }
  if (body.tipe !== undefined) {
    if (!['MASUK', 'KELUAR'].includes(body.tipe)) {
      return apiBadRequest('tipe harus salah satu dari: MASUK, KELUAR')
    }
    values.push(body.tipe)
    updates.push(`tipe = $${values.length}`)
  }
  if (body.nominal !== undefined) {
    const n = Number(body.nominal)
    if (!n || n <= 0) return apiBadRequest('nominal harus > 0')
    values.push(n)
    updates.push(`nominal = $${values.length}`)
  }
  if (body.metode !== undefined) {
    if (body.metode && !METODE_PEMBAYARAN.includes(body.metode)) {
      return apiBadRequest(`metode harus salah satu dari: ${METODE_PEMBAYARAN.join(', ')}`)
    }
    values.push(body.metode || null)
    updates.push(`metode = $${values.length}`)
  }
  if (body.tanggal_setiap_bulan !== undefined) {
    const tgl = Number(body.tanggal_setiap_bulan)
    if (!Number.isInteger(tgl) || tgl < 1 || tgl > 31) {
      return apiBadRequest('tanggal_setiap_bulan harus 1-31')
    }
    values.push(tgl)
    updates.push(`tanggal_setiap_bulan = $${values.length}`)
  }
  if (body.aktif !== undefined) {
    values.push(Boolean(body.aktif))
    updates.push(`aktif = $${values.length}`)
  }

  if (updates.length === 0) {
    return apiBadRequest('Tidak ada field yang diupdate')
  }

  try {
    const existingRes = await query('SELECT outlet_id FROM recurring_transactions WHERE id = $1 LIMIT 1', [id])
    if (existingRes.rows.length === 0) return apiBadRequest('Template tidak ditemukan')
    const existing = existingRes.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    values.push(id)
    const res = await query(
      `UPDATE recurring_transactions SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )
    return apiOk(res.rows[0])
  } catch (error: any) {
    return apiError(error, 500, '[PATCH recurring]', 'Gagal mengupdate template recurring')
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireOwner(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  try {
    const existingRes = await query('SELECT outlet_id FROM recurring_transactions WHERE id = $1 LIMIT 1', [id])
    if (existingRes.rows.length === 0) return apiBadRequest('Template tidak ditemukan')
    const existing = existingRes.rows[0]

    if (profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    await query('DELETE FROM recurring_transactions WHERE id = $1', [id])
    return apiOk({ ok: true })
  } catch (error: any) {
    return apiError(error, 500, '[DELETE recurring]', 'Gagal menghapus template recurring')
  }
}