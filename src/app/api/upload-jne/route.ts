import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { parseJnePdf } from '@/lib/parsers/jnePdfParser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kurirId = formData.get('kurir_id') as string
    const periodeManual = formData.get('periode') as string

    if (!file || !kurirId) {
      return NextResponse.json({ error: 'File dan ekspedisi wajib diisi' }, { status: 400 })
    }

    const kurirRes = await query('SELECT id, kode FROM kurir WHERE id = $1 LIMIT 1', [kurirId])
    if (kurirRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ekspedisi tidak ditemukan' }, { status: 400 })
    }
    const kurirData = kurirRes.rows[0]

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, totalRows, errors, periode: periodeDetected } = await parseJnePdf(buffer)

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada baris Packing List yang berhasil dibaca dari PDF',
        details: errors,
      }, { status: 400 })
    }

    const periode = periodeManual || periodeDetected || null

    const nomorPlList = rows.map(r => r.nomor_pl)
    let duplikatList: { pl: string; periode: string }[] = []

    if (nomorPlList.length > 0) {
      const existingRes = await query(
        'SELECT nomor_pl FROM jne_packing_list WHERE kurir_id = $1 AND nomor_pl = ANY($2)',
        [kurirData.id, nomorPlList]
      )
      const duplikatSet = new Set(existingRes.rows.map(e => e.nomor_pl))
      duplikatList = [...duplikatSet].map(pl => ({ pl, periode: periode || '—' }))
    }

    let successRows = 0
    for (const row of rows) {
      try {
        await query(
          `INSERT INTO jne_packing_list (
            kurir_id, nomor_pl, tanggal, amount, publish_rate, cnote_count, insurance,
            vat_amount, discount, disc_others, total_net, coly, weight, date_paid, outstanding, periode
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (kurir_id, nomor_pl) DO UPDATE SET
            tanggal = EXCLUDED.tanggal,
            amount = EXCLUDED.amount,
            publish_rate = EXCLUDED.publish_rate,
            cnote_count = EXCLUDED.cnote_count,
            insurance = EXCLUDED.insurance,
            vat_amount = EXCLUDED.vat_amount,
            discount = EXCLUDED.discount,
            disc_others = EXCLUDED.disc_others,
            total_net = EXCLUDED.total_net,
            coly = EXCLUDED.coly,
            weight = EXCLUDED.weight,
            date_paid = EXCLUDED.date_paid,
            outstanding = EXCLUDED.outstanding,
            periode = EXCLUDED.periode`,
          [
            kurirData.id, row.nomor_pl, row.tanggal, row.amount, row.publish_rate, row.cnote_count, row.insurance,
            row.vat_amount, row.discount, row.disc_others, row.total_net, row.coly, row.weight, row.date_paid, row.outstanding, periode
          ]
        )
        successRows++
      } catch (e) {
        console.error(`JNE row insert error:`, e)
      }
    }

    await query(
      `INSERT INTO upload_logs (kurir_id, filename, periode, total_rows, success_rows, error_rows, errors)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        kurirData.id, file.name, periode, totalRows, successRows,
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
      periodeDetected,
    })

  } catch (err) {
    console.error('JNE upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}