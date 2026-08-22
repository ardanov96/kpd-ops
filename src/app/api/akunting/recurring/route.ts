import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { TRANSAKSI_TIPE, METODE_PEMBAYARAN } from '@/types'

export const dynamic = 'force-dynamic'

// POST: tambah template recurring (owner only)
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
  const { outlet_id, nama_template, kategori_id, tipe, nominal, metode, tanggal_setiap_bulan, aktif } = body

  if (!outlet_id) return apiBadRequest('outlet_id wajib')
  if (!nama_template || !nama_template.trim()) return apiBadRequest('nama_template wajib')
  if (!kategori_id) return apiBadRequest('kategori_id wajib')
  if (!['MASUK', 'KELUAR'].includes(tipe)) {
    return apiBadRequest('tipe harus MASUK atau KELUAR')
  }
  const n = Number(nominal)
  if (!n || n <= 0) return apiBadRequest('nominal harus > 0')
  const tgl = Number(tanggal_setiap_bulan)
  if (!Number.isInteger(tgl) || tgl < 1 || tgl > 31) {
    return apiBadRequest('tanggal_setiap_bulan harus 1-31')
  }
  if (metode && !METODE_PEMBAYARAN.includes(metode)) {
    return apiBadRequest(`metode harus salah satu dari: ${METODE_PEMBAYARAN.join(', ')}`)
  }

  // Defense-in-depth
  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('recurring_transactions')
    .insert({
      outlet_id,
      nama_template: nama_template.trim(),
      kategori_id,
      tipe,
      nominal: n,
      metode: metode || null,
      tanggal_setiap_bulan: tgl,
      aktif: aktif !== false,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST recurring]', 'Gagal menambah template recurring')
  return apiOk(data, 201)
}

// GET: list template per outlet (auth required, staff boleh lihat outlet sendiri)
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  // Defense-in-depth
  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) {
      return apiOk([])
    }
    effectiveOutletId = profile.outlet_id
  }

  let query = admin
    .from('recurring_transactions')
    .select('*, kategori:kategori_akun(kode, nama)')
    .order('aktif', { ascending: false })
    .order('tanggal_setiap_bulan')

  if (effectiveOutletId) query = query.eq('outlet_id', effectiveOutletId)

  const { data, error } = await query
  if (error) return apiError(error, 500, '[GET recurring]', 'Gagal memuat template recurring')
  return apiOk(data || [])
}