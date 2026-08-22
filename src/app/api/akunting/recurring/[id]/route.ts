import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { TRANSAKSI_TIPE, METODE_PEMBAYARAN } from '@/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH: update template (owner only)
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

  const update: Record<string, unknown> = {}
  if (body.nama_template !== undefined) {
    if (!body.nama_template || !body.nama_template.trim()) {
      return apiBadRequest('nama_template wajib diisi')
    }
    update.nama_template = body.nama_template.trim()
  }
  if (body.kategori_id !== undefined) update.kategori_id = body.kategori_id
  if (body.tipe !== undefined) {
    if (!['MASUK', 'KELUAR'].includes(body.tipe)) {
      return apiBadRequest(`tipe harus salah satu dari: MASUK, KELUAR`)
    }
    update.tipe = body.tipe
  }
  if (body.nominal !== undefined) {
    const n = Number(body.nominal)
    if (!n || n <= 0) return apiBadRequest('nominal harus > 0')
    update.nominal = n
  }
  if (body.metode !== undefined) {
    if (body.metode && !METODE_PEMBAYARAN.includes(body.metode)) {
      return apiBadRequest(`metode harus salah satu dari: ${METODE_PEMBAYARAN.join(', ')}`)
    }
    update.metode = body.metode || null
  }
  if (body.tanggal_setiap_bulan !== undefined) {
    const tgl = Number(body.tanggal_setiap_bulan)
    if (!Number.isInteger(tgl) || tgl < 1 || tgl > 31) {
      return apiBadRequest('tanggal_setiap_bulan harus 1-31')
    }
    update.tanggal_setiap_bulan = tgl
  }
  if (body.aktif !== undefined) update.aktif = !!body.aktif

  if (Object.keys(update).length === 0) {
    return apiBadRequest('Tidak ada field yang diupdate')
  }

  const admin = createAdminClient()

  // Defense-in-depth: cek outlet_id template
  const { data: existing } = await admin.from('recurring_transactions').select('outlet_id').eq('id', id).single()
  if (existing && profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('recurring_transactions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 500, '[PATCH recurring]', 'Gagal mengupdate template recurring')
  return apiOk(data)
}

// DELETE: hapus template (owner only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireOwner(_req)
  if (isAuthError(guard)) return guard
  const { profile } = guard
  const { id } = await params

  const admin = createAdminClient()

  // Defense-in-depth
  const { data: existing } = await admin.from('recurring_transactions').select('outlet_id').eq('id', id).single()
  if (existing && profile.role !== 'owner' && profile.outlet_id !== existing.outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { error } = await admin
    .from('recurring_transactions')
    .delete()
    .eq('id', id)

  if (error) return apiError(error, 500, '[DELETE recurring]', 'Gagal menghapus template recurring')
  return apiOk({ ok: true })
}