import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, requireAuth, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'
import { TRANSAKSI_TIPE, METODE_PEMBAYARAN } from '@/types'
import { uploadNota, validateFile, deleteFile, BUCKET_NOTA } from '@/lib/storage'
import { getCurrentPeriodeWIB } from '@/lib/timezone'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  const contentType = req.headers.get('content-type') || ''
  let outlet_id = ''
  let tanggal = ''
  let tipe: any = ''
  let kategori_id = ''
  let nominal: any = 0
  let metode: any = null
  let keterangan: any = null
  let lampiran_url: string | null = null
  let file: File | null = null

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return apiBadRequest('Body multipart form data tidak valid')
    }
    outlet_id = (formData.get('outlet_id') as string) || ''
    tanggal = (formData.get('tanggal') as string) || ''
    tipe = (formData.get('tipe') as string) || ''
    kategori_id = (formData.get('kategori_id') as string) || ''
    nominal = formData.get('nominal')
    metode = (formData.get('metode') as string) || null
    keterangan = (formData.get('keterangan') as string) || null
    lampiran_url = (formData.get('lampiran_url') as string) || null
    const f = formData.get('file')
    if (f && typeof f === 'object' && 'size' in f && (f as File).size > 0) {
      file = f as File
    }
  } else {
    let body: any
    try {
      body = await req.json()
    } catch {
      return apiBadRequest('Body harus JSON atau multipart/form-data')
    }
    outlet_id = body.outlet_id
    tanggal = body.tanggal
    tipe = body.tipe
    kategori_id = body.kategori_id
    nominal = body.nominal
    metode = body.metode || null
    keterangan = body.keterangan || null
    lampiran_url = body.lampiran_url || null
  }

  if (metode && typeof metode === 'string') {
    metode = metode.trim() || null
  }
  if (keterangan && typeof keterangan === 'string') {
    keterangan = keterangan.trim() || null
  }

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

  // ✅ Lock check: tolak transaksi di period yg sudah di-closing.
  // Inline SQL (bukan function) supaya portable sebelum migration 021.
  const lockRes = await query(
    `SELECT is_locked FROM periode_closing
     WHERE outlet_id = $1 AND periode = $2 LIMIT 1`,
    [outlet_id, (tanggal || '').slice(0, 7)]
  )
  if (lockRes.rows[0]?.is_locked === true) {
    return NextResponse.json({
      error: `Transaksi ditolak: periode ${(tanggal || '').slice(0, 7)} sudah di-closing. Buka periode terlebih dahulu jika perlu update data.`,
    }, { status: 403 })
  }

  try {
    const katRes = await query('SELECT id, tipe, kode, nama FROM kategori_akun WHERE id = $1 LIMIT 1', [kategori_id])
    if (katRes.rows.length === 0) return apiBadRequest('Kategori tidak ditemukan')
    const kat = katRes.rows[0]

    // ✅ Enforce Metode A: Blokir input manual kategori 5100 (Beban ATK & Packaging)
    if (tipe === 'KELUAR' && kat.kode === '5100') {
      return apiBadRequest(
        'Kategori 5100 (Beban ATK & Packaging) dicatat otomatis melalui Modul Inventaris saat Stok Keluar (Metode A). Input manual diblokir untuk mencegah beban ganda. Silakan catat di Modul Inventaris.'
      )
    }

    const expectedTipe = tipe === 'MASUK' ? 'INCOME' : tipe === 'KELUAR' ? 'EXPENSE' : null
    const validTipeAkun = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
    if (expectedTipe && kat.tipe !== expectedTipe && !validTipeAkun.includes(kat.tipe)) {
      return apiBadRequest(`Kategori ${kat.tipe} tidak cocok dengan tipe transaksi ${tipe}`)
    }

    const trxId = crypto.randomUUID()
    let uploadedFilePath: string | null = null

    // Upload nota jika dilampirkan (Atomic: jika gagal upload, batalkan sebelum insert DB)
    if (file) {
      const valErr = validateFile(file)
      if (valErr) {
        const status = valErr.code === 'FILE_TOO_LARGE' ? 413 : 400
        return NextResponse.json({ error: valErr.error, code: valErr.code }, { status })
      }

      const subfolder = (tanggal || '').slice(0, 7) || getCurrentPeriodeWIB()
      const upRes = await uploadNota({
        outletId: outlet_id,
        refId: trxId,
        subfolder,
        file,
      })

      if (upRes.error || !upRes.data) {
        const status = upRes.error?.code === 'FILE_TOO_LARGE' ? 413 : 400
        return NextResponse.json(
          { error: upRes.error?.error || 'Upload nota gagal', code: upRes.error?.code || 'UPLOAD_FAILED' },
          { status }
        )
      }

      uploadedFilePath = upRes.data.path
      lampiran_url = uploadedFilePath
    }

    try {
      const res = await query(
        `INSERT INTO transaksi_keuangan (id, outlet_id, tanggal, tipe, kategori_id, sumber, nominal, metode, keterangan, lampiran_url, created_by)
         VALUES ($1, $2, $3, $4, $5, 'MANUAL', $6, $7, $8, $9, $10)
         RETURNING *`,
        [trxId, outlet_id, tanggal, tipe, kategori_id, n, metode || null, keterangan || null, lampiran_url || null, profile.id]
      )

      return apiOk(res.rows[0], 201)
    } catch (insertError: any) {
      // Rollback file upload jika insert DB gagal agar tidak meninggalkan orphan file
      if (uploadedFilePath) {
        try {
          await deleteFile(BUCKET_NOTA, uploadedFilePath)
        } catch (delErr) {
          console.warn('[POST transaksi] Gagal rollback nota expense:', delErr)
        }
      }
      throw insertError
    }
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