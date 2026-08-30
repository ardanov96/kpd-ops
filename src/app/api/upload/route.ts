import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { parseXLSX } from '@/lib/parsers/xlsxParser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kurirId = formData.get('kurir_id') as string
    const periode = formData.get('periode') as string

    if (!file || !kurirId) {
      return NextResponse.json({ error: 'File dan ekspedisi wajib diisi' }, { status: 400 })
    }

    const kurirRes = await query('SELECT id, kode FROM kurir WHERE id = $1 LIMIT 1', [kurirId])
    if (kurirRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ekspedisi tidak ditemukan' }, { status: 400 })
    }
    const kurirData = kurirRes.rows[0]

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, errors, totalRows } = parseXLSX(buffer, kurirData.kode)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada baris valid', details: errors }, { status: 400 })
    }

    const outletRes = await query('SELECT id FROM outlets ORDER BY created_at ASC LIMIT 1')
    const outletId = outletRes.rows[0]?.id ?? null

    if (!outletId) {
      return NextResponse.json({
        error: 'Outlet belum ada di database. Silakan buat outlet terlebih dahulu.',
      }, { status: 400 })
    }

    const nomorSttList = rows.map(r => r.nomor_stt).filter(Boolean)
    let duplikatList: { stt: string; periode: string }[] = []

    if (nomorSttList.length > 0) {
      const existingRes = await query(
        'SELECT nomor_stt, to_char(tanggal, \'YYYY-MM\') as periode FROM transaksi WHERE kurir_id = $1 AND nomor_stt = ANY($2)',
        [kurirData.id, nomorSttList]
      )
      duplikatList = existingRes.rows.map(e => ({ stt: e.nomor_stt, periode: e.periode || '—' }))
    }

    let successRows = 0

    for (const row of rows) {
      try {
        await query(
          `INSERT INTO transaksi (
            outlet_id, kurir_id, nomor_stt, tanggal, jenis_kiriman, kota_tujuan, kecamatan_tujuan,
            nama_produk, komoditas, koli, berat_volume, berat_kotor, berat_kena_biaya,
            publish_rate, shipping_surcharge, forward_rate, biaya_asuransi, biaya_cod,
            total_sebelum_potongan, potongan, total_biaya, total_cod, diskon_booking,
            diskon_pickup, diskon_asuransi, diskon_forward_rate, bm, ppn, pph, status, raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
          )
          ON CONFLICT (kurir_id, nomor_stt) DO UPDATE SET
            tanggal = EXCLUDED.tanggal,
            jenis_kiriman = EXCLUDED.jenis_kiriman,
            kota_tujuan = EXCLUDED.kota_tujuan,
            kecamatan_tujuan = EXCLUDED.kecamatan_tujuan,
            nama_produk = EXCLUDED.nama_produk,
            komoditas = EXCLUDED.komoditas,
            koli = EXCLUDED.koli,
            berat_volume = EXCLUDED.berat_volume,
            berat_kotor = EXCLUDED.berat_kotor,
            berat_kena_biaya = EXCLUDED.berat_kena_biaya,
            publish_rate = EXCLUDED.publish_rate,
            shipping_surcharge = EXCLUDED.shipping_surcharge,
            forward_rate = EXCLUDED.forward_rate,
            biaya_asuransi = EXCLUDED.biaya_asuransi,
            biaya_cod = EXCLUDED.biaya_cod,
            total_sebelum_potongan = EXCLUDED.total_sebelum_potongan,
            potongan = EXCLUDED.potongan,
            total_biaya = EXCLUDED.total_biaya,
            total_cod = EXCLUDED.total_cod,
            diskon_booking = EXCLUDED.diskon_booking,
            diskon_pickup = EXCLUDED.diskon_pickup,
            diskon_asuransi = EXCLUDED.diskon_asuransi,
            diskon_forward_rate = EXCLUDED.diskon_forward_rate,
            bm = EXCLUDED.bm,
            ppn = EXCLUDED.ppn,
            pph = EXCLUDED.pph,
            status = EXCLUDED.status,
            raw_data = EXCLUDED.raw_data`,
          [
            outletId, kurirData.id, row.nomor_stt, row.tanggal, row.jenis_kiriman, row.kota_tujuan, row.kecamatan_tujuan,
            row.nama_produk, row.komoditas, row.koli, row.berat_volume, row.berat_kotor, row.berat_kena_biaya,
            row.publish_rate, row.shipping_surcharge, row.forward_rate, row.biaya_asuransi, row.biaya_cod,
            row.total_sebelum_potongan, row.potongan, row.total_biaya, row.total_cod, row.diskon_booking,
            row.diskon_pickup, row.diskon_asuransi, row.diskon_forward_rate, row.bm, row.ppn, row.pph, row.status,
            JSON.stringify(row.raw_data || {})
          ]
        )
        successRows++
      } catch (e) {
        console.error(`Row insert failed for STT ${row.nomor_stt}:`, e)
      }
    }

    let aggregatePeriods: string[] = []
    let aggregateErrors: string[] = []
    if (successRows > 0) {
      const periodSet = new Set<string>()
      for (const row of rows) {
        if (!row.tanggal) continue
        const t = String(row.tanggal).slice(0, 7)
        if (/^\d{4}-\d{2}$/.test(t)) periodSet.add(t)
      }
      aggregatePeriods = Array.from(periodSet)
      for (const p of aggregatePeriods) {
        try {
          await query('SELECT fn_aggregate_income($1, $2)', [outletId, p])
        } catch (e: any) {
          console.error(`[upload] fn_aggregate_income(${p}) gagal:`, e?.message)
          aggregateErrors.push(`${p}: ${e?.message}`)
        }
      }
    }

    await query(
      `INSERT INTO upload_logs (kurir_id, outlet_id, filename, periode, total_rows, success_rows, error_rows, errors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        kurirData.id, outletId, file.name, periode, totalRows, successRows,
        totalRows - successRows + errors.length, errors.length > 0 ? JSON.stringify(errors) : null
      ]
    )

    return NextResponse.json({
      success: true,
      totalRows,
      successRows,
      errorRows: errors.length,
      errors: errors.slice(0, 10),
      duplikat: duplikatList,
      duplikatCount: duplikatList.length,
      aggregatedPeriods: aggregatePeriods,
      aggregateErrors: aggregateErrors.length > 0 ? aggregateErrors : undefined,
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}