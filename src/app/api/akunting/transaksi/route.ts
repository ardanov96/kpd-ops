import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { TRANSAKSI_TIPE, METODE_PEMBAYARAN } from '@/types'

export const dynamic = 'force-dynamic'

// POST: tambah transaksi keuangan manual (owner only)
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { supabase, profile } = guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { outlet_id, tanggal, tipe, kategori_id, nominal, metode, keterangan } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return apiBadRequest('outlet_id wajib diisi')
  if (!tanggal) return apiBadRequest('tanggal wajib diisi')
  if (!TRANSAKSI_TIPE.includes(tipe)) {
    return apiBadRequest(`tipe harus salah satu dari: ${TRANSAKSI_TIPE.join(', ')}`)
  }
  if (!kategori_id) return apiBadRequest('kategori_id wajib diisi')
  const n = Number(nominal)
  if (!n || n <= 0) return apiBadRequest('nominal harus > 0')
  if (metode && !METODE_PEMBAYARAN.includes(metode)) {
    return apiBadRequest(`metode harus salah satu dari: ${METODE_PEMBAYARAN.join(', ')}`)
  }

  // ── Cek outlet ownership (defense-in-depth) ────────
  // Owner boleh akses semua outlet. Staff dibatasi ke outlet sendiri.
  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  // ── Pakai admin client untuk query (sudah authorized via requireOwner) ─
  const admin = createAdminClient()

  // Cek kategori sesuai tipe
  const { data: kat, error: errKat } = await admin
    .from('kategori_akun')
    .select('id, tipe')
    .eq('id', kategori_id)
    .single()

  if (errKat || !kat) return apiBadRequest('Kategori tidak ditemukan')

  // Mapping validasi tipe transaksi vs tipe akun
  const expectedTipe = tipe === 'MASUK' ? 'INCOME' : tipe === 'KELUAR' ? 'EXPENSE' : null
  const validTipeAkun = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
  if (expectedTipe && kat.tipe !== expectedTipe && !validTipeAkun.includes(kat.tipe)) {
    return apiBadRequest(`Kategori ${kat.tipe} tidak cocok dengan tipe transaksi ${tipe}`)
  }

  const { data, error } = await admin
    .from('transaksi_keuangan')
    .insert({
      outlet_id,
      tanggal,
      tipe,
      kategori_id,
      sumber: 'MANUAL',
      nominal: n,
      metode: metode || null,
      keterangan: keterangan || null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return apiError(error, 500, '[POST transaksi]', 'Gagal menyimpan transaksi')
  return apiOk(data, 201)
}

// GET: list transaksi (auth required, staff boleh akses outlet sendiri)
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const periode = searchParams.get('periode')

  // Defense-in-depth: kalau staff, paksa outlet_id = profile.outlet_id
  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) {
      return apiBadRequest('Profile tidak terkait outlet manapun')
    }
    effectiveOutletId = profile.outlet_id
  }

  let query = admin
    .from('transaksi_keuangan')
    .select('*, kategori:kategori_akun(kode, nama, tipe)')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (effectiveOutletId) query = query.eq('outlet_id', effectiveOutletId)
  if (periode) {
    // periode = YYYY-MM
    const start = `${periode}-01`
    const [y, m] = periode.split('-').map(Number)
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    query = query.gte('tanggal', start).lt('tanggal', nextMonth)
  }

  const { data, error } = await query
  if (error) return apiError(error, 500, '[GET transaksi]', 'Gagal memuat daftar transaksi')
  return apiOk(data || [])
}