import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { METODE_PEMBAYARAN } from '@/types'

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
  const { outlet_id, nama_template, kategori_id, tipe, nominal, metode, tanggal_setiap_bulan, aktif, interval_bulan, barang_id } = body

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

  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  try {
    const katRes = await query('SELECT kode, nama FROM kategori_akun WHERE id = $1 LIMIT 1', [kategori_id])
    if (katRes.rows[0]?.kode === '5100' && !barang_id) {
      return apiBadRequest('Kategori 5100 (Beban ATK & Packaging) harus ditautkan ke barang inventaris (barang_id) agar pergerakan stok otomatis tersinkronisasi.')
    }

    const res = await query(
      `INSERT INTO recurring_transactions (outlet_id, nama_template, kategori_id, tipe, nominal, metode, tanggal_setiap_bulan, interval_bulan, barang_id, aktif, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [outlet_id, nama_template.trim(), kategori_id, tipe, n, metode || null, tgl, Math.max(1, Number(interval_bulan) || 1), barang_id || null, aktif !== false, profile.id]
    )

    return apiOk(res.rows[0], 201)
  } catch (error: any) {
    return apiError(error, 500, '[POST recurring]', 'Gagal menambah template recurring')
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) {
      return apiOk([])
    }
    effectiveOutletId = profile.outlet_id
  }

  try {
    let sql = `
      SELECT rt.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori,
        case when b.id is not null then json_build_object('id', b.id, 'nama', b.nama, 'satuan', b.satuan) else null end as barang
      FROM recurring_transactions rt
      LEFT JOIN kategori_akun k ON k.id = rt.kategori_id
      LEFT JOIN barang b ON b.id = rt.barang_id
      WHERE 1=1
    `
    const params: any[] = []

    if (effectiveOutletId) {
      params.push(effectiveOutletId)
      sql += ` AND rt.outlet_id = $${params.length}`
    }

    sql += ' ORDER BY rt.aktif DESC, rt.tanggal_setiap_bulan ASC'

    const res = await query(sql, params)
    return apiOk(res.rows)
  } catch (error: any) {
    return apiError(error, 500, '[GET recurring]', 'Gagal memuat template recurring')
  }
}