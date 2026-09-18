import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db'
import { parseJnePdf } from '@/lib/parsers/jnePdfParser'
import { requireAuth, isAuthError } from '@/lib/api/auth'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kurirId = formData.get('kurir_id') as string
    const periodeManual = formData.get('periode') as string

    if (!file || !kurirId) {
      return NextResponse.json({ error: 'File dan ekspedisi wajib diisi' }, { status: 400 })
    }

    // ✅ JNE hanya menerima PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'JNE hanya menerima file PDF (.pdf)' }, { status: 400 })
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: `Tipe file harus application/pdf, dapat: ${file.type}` }, { status: 400 })
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks 50 MB.` }, { status: 413 })
    }

    // ✅ Validasi kurir benar-benar JNE (cegah mis-routing ke kurir lain)
    const kurirRes = await query('SELECT id, kode, nama FROM kurir WHERE id = $1 LIMIT 1', [kurirId])
    if (kurirRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ekspedisi tidak ditemukan' }, { status: 400 })
    }
    const kurirData = kurirRes.rows[0]
    if (kurirData.kode !== 'JNE') {
      return NextResponse.json({
        error: `Endpoint ini khusus franchise JNE. Kurir '${kurirData.nama}' harus pakai endpoint upload XLSX.`,
      }, { status: 400 })
    }

    // ✅ Resolve outlet_id dari session (fallback ke outlet pertama untuk owner tanpa outlet_id)
    let outletId: string | null = profile.outlet_id ?? null
    if (!outletId) {
      const outletRes = await query('SELECT id FROM outlets ORDER BY created_at ASC LIMIT 1')
      outletId = outletRes.rows[0]?.id ?? null
    }
    if (!outletId) {
      return NextResponse.json({
        error: 'Outlet belum ada di database. Silakan buat outlet terlebih dahulu.',
      }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parseResult = await parseJnePdf(buffer)
    const { rows, totalRows, errors, periodeHint, warnings } = parseResult

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada baris Packing List yang berhasil dibaca dari PDF. Pastikan PDF adalah Rekapitulasi Packing List JNE.',
        details: errors,
        warnings,
      }, { status: 400 })
    }

    // Resolve periode: prioritas user input → hint dari header PDF →
    // derived dari baris. Tolak kalau baris spanning >1 bulan (split
    // upload per periode lebih aman).
    const periodsInRows = Array.from(new Set(
      rows.map(r => r.tanggal ? r.tanggal.slice(0, 7) : null).filter(Boolean)
    ))
    if (periodsInRows.length > 1) {
      return NextResponse.json({
        error: `PDF mengandung baris dari ${periodsInRows.length} periode (${periodsInRows.join(', ')}). Split upload per periode lebih aman.`,
        periodsInRows,
      }, { status: 400 })
    }
    const periodeDerived = periodsInRows[0] || null
    const periode = periodeManual || periodeHint || periodeDerived

    if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
      return NextResponse.json({
        error: 'Periode tidak terdeteksi di PDF, tidak dipilih manual, dan tidak bisa di-derive dari baris.',
        hint: periodeHint,
        derived: periodeDerived,
      }, { status: 400 })
    }

    const nomorPlList = rows.map(r => r.nomor_pl)
    let duplikatList: { pl: string; periode: string; action: string }[] = []

    if (nomorPlList.length > 0) {
      const existingRes = await query(
        'SELECT nomor_pl FROM jne_packing_list WHERE outlet_id = $1 AND kurir_id = $2 AND nomor_pl = ANY($3)',
        [outletId, kurirData.id, nomorPlList]
      )
      const duplikatSet = new Set(existingRes.rows.map(e => e.nomor_pl))
      duplikatList = [...duplikatSet].map(pl => ({
        pl,
        periode,
        action: 'updated',
      }))
    }

    let successRows = 0
    try {
      successRows = await withTransaction(async (run) => {
        let count = 0
        for (const row of rows) {
          await run(
            `INSERT INTO jne_packing_list (
              outlet_id, kurir_id, nomor_pl, tanggal, amount, publish_rate, cnote_count, insurance,
              vat_amount, discount, disc_others, total_net, coly, weight, date_paid, outstanding
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            ON CONFLICT (outlet_id, kurir_id, nomor_pl) DO UPDATE SET
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
              outstanding = EXCLUDED.outstanding`,
            [
              outletId, kurirData.id, row.nomor_pl, row.tanggal, row.amount, row.publish_rate, row.cnote_count, row.insurance,
              row.vat_amount, row.discount, row.disc_others, row.total_net, row.coly, row.weight, row.date_paid, row.outstanding
            ]
          )
          count++
        }
        return count
      })
    } catch (e: any) {
      console.error('[upload-jne] insert rolled back:', e?.message)
      return NextResponse.json({
        error: `Insert JNE packing list gagal, semua baris di-rollback: ${e?.message}`,
        rolledBack: true,
      }, { status: 500 })
    }

    // ── Aggregate ke transaksi_keuangan agar muncul di Akunting/Dashboard
    try {
      await query('SELECT fn_aggregate_income_jne($1, $2)', [outletId, periode])
    } catch (e: any) {
      console.error(`[upload-jne] fn_aggregate_income_jne(${periode}) gagal:`, e?.message)
      warnings.push(`Aggregate income gagal: ${e?.message}`)
    }

    await query(
      `INSERT INTO upload_logs (outlet_id, kurir_id, filename, periode, total_rows, success_rows, error_rows, errors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        outletId, kurirData.id, file.name, periode, totalRows, successRows,
        totalRows - successRows + errors.length,
        errors.length > 0 ? JSON.stringify(errors.slice(0, 20)) : null
      ]
    )

    return NextResponse.json({
      success: true,
      totalRows,
      successRows,
      errorRows: errors.length,
      errors: errors.slice(0, 10),
      warnings,
      duplikat: duplikatList,
      duplikatCount: duplikatList.length,
      periodeHint,
      periodeUsed: periode,
    })

  } catch (err) {
    console.error('JNE upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
