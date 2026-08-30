import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { TRANSAKSI_TIPE, METODE_PEMBAYARAN } from '@/types'

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
  const { outlet_id, tanggal, tipe, kategori_id, nominal, metode, keterangan } = body

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

  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  try {
    const katRes = await query('SELECT id, tipe FROM kategori_akun WHERE id = $1 LIMIT 1', [kategori_id])
    if (katRes.rows.length === 0) return apiBadRequest('Kategori tidak ditemukan')
    const kat = katRes.rows[0]

    const expectedTipe = tipe === 'MASUK' ? 'INCOME' : tipe === 'KELUAR' ? 'EXPENSE' : null
    const validTipeAkun = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
    if (expectedTipe && kat.tipe !== expectedTipe && !validTipeAkun.includes(kat.tipe)) {
      return apiBadRequest(`Kategori ${kat.tipe} tidak cocok dengan tipe transaksi ${tipe}`)
    }

    const res = await query(
      `INSERT INTO transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal, metode, keterangan, created_by)
       VALUES ($1, $2, $3, $4, 'MANUAL', $5, $6, $7, $8)
       RETURNING *`,
      [outlet_id, tanggal, tipe, kategori_id, n, metode || null, keterangan || null, profile.id]
    )

    return apiOk(res.rows[0], 201)
  } catch (error: any) {
    return apiError(error, 500, '[POST transaksi]', 'Gagal menyimpan transaksi')
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const periode = searchParams.get('periode')

  let effectiveOutletId = outletId
  if (profile.role !== 'owner') {
    if (!profile.outlet_id) {
      return apiBadRequest('Profile tidak terkait outlet manapun')
    }
    effectiveOutletId = profile.outlet_id
  }

  try {
    let sql = `
      SELECT tk.*,
        json_build_object('kode', k.kode, 'nama', k.nama, 'tipe', k.tipe) as kategori
      FROM transaksi_keuangan tk
      LEFT JOIN kategori_akun k ON k.id = tk.kategori_id
      WHERE 1=1
    `
    const params: any[] = []

    if (effectiveOutletId) {
      params.push(effectiveOutletId)
      sql += ` AND tk.outlet_id = $${params.length}`
    }

    if (periode) {
      params.push(`${periode}-01`)
      const startIdx = params.length
      const [y, m] = periode.split('-').map(Number)
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      params.push(nextMonth)
      const endIdx = params.length

      sql += ` AND tk.tanggal >= $${startIdx} AND tk.tanggal < $${endIdx}`
    }

    sql += ' ORDER BY tk.tanggal DESC, tk.created_at DESC LIMIT 500'

    const res = await query(sql, params)
    return apiOk(res.rows)
  } catch (error: any) {
    return apiError(error, 500, '[GET transaksi]', 'Gagal memuat daftar transaksi')
  }
}