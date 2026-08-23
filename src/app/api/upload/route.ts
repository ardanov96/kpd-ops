import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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

    const supabase = createAdminClient()

    const { data: kurirData, error: kurirErr } = await supabase
      .from('kurir').select('id, kode').eq('id', kurirId).single()

    if (kurirErr || !kurirData) {
      return NextResponse.json({ error: 'Ekspedisi tidak ditemukan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, errors, totalRows } = parseXLSX(buffer, kurirData.kode)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada baris valid', details: errors }, { status: 400 })
    }

    // ✅ Cek duplikat STT yang sudah ada di database
    const nomorSttList = rows.map(r => r.nomor_stt).filter(Boolean)
    const { data: existing } = await supabase
      .from('transaksi')
      .select('nomor_stt, tanggal, periode:tanggal')
      .eq('kurir_id', kurirData.id)
      .in('nomor_stt', nomorSttList)

    const duplikatMap: Record<string, string> = {}
    existing?.forEach(e => {
      duplikatMap[e.nomor_stt] = e.tanggal?.slice(0, 7) || '—'
    })
    const duplikatList = Object.entries(duplikatMap).map(([stt, periode]) => ({ stt, periode }))

    // ✅ Cari outlet_id untuk transaksi (FK NOT NULL).
    // Pakai outlet pertama (sama seperti halaman server component existing).
    const { data: outletRow } = await supabase
      .from('outlets')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    const outletId = outletRow?.id ?? null

    if (!outletId) {
      return NextResponse.json({
        error: 'Outlet belum ada di database. Tambahkan outlet di Supabase terlebih dahulu.',
      }, { status: 400 })
    }

    const insertData = rows.map(row => ({
      outlet_id: outletId,
      kurir_id: kurirData.id,
      nomor_stt: row.nomor_stt,
      tanggal: row.tanggal,
      jenis_kiriman: row.jenis_kiriman,
      kota_tujuan: row.kota_tujuan,
      kecamatan_tujuan: row.kecamatan_tujuan,
      nama_produk: row.nama_produk,
      komoditas: row.komoditas,
      koli: row.koli,
      berat_volume: row.berat_volume,
      berat_kotor: row.berat_kotor,
      berat_kena_biaya: row.berat_kena_biaya,
      publish_rate: row.publish_rate,
      shipping_surcharge: row.shipping_surcharge,
      forward_rate: row.forward_rate,
      biaya_asuransi: row.biaya_asuransi,
      biaya_cod: row.biaya_cod,
      total_sebelum_potongan: row.total_sebelum_potongan,
      potongan: row.potongan,
      total_biaya: row.total_biaya,
      total_cod: row.total_cod,
      diskon_booking: row.diskon_booking,
      diskon_pickup: row.diskon_pickup,
      diskon_asuransi: row.diskon_asuransi,
      diskon_forward_rate: row.diskon_forward_rate,
      bm: row.bm,
      ppn: row.ppn,
      pph: row.pph,
      status: row.status,
      raw_data: row.raw_data,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('transaksi')
      .upsert(insertData, { onConflict: 'kurir_id,nomor_stt', ignoreDuplicates: false })
      .select('id')

    if (insertErr) console.error('INSERT ERROR:', JSON.stringify(insertErr, null, 2))

    const successRows = inserted?.length || 0

    // ✅ Sprint 2 integration: auto-aggregate income per periode (idempotent).
    // Setelah insert ke `transaksi`, panggil fn_aggregate_income(outlet_id, 'YYYY-MM')
    // untuk generate/update baris KURIR income di `transaksi_keuangan` (kategori 4100).
    // Function ini idempotent — kalau sudah ada baris KURIR untuk periode itu,
    // dia akan replace dengan net omzet terbaru. Aman untuk upload berulang.
    // Lihat 004_akunting.sql untuk definisi function.
    let aggregatePeriods: string[] = []
    let aggregateErrors: string[] = []
    if (successRows > 0) {
      const periodSet = new Set<string>()
      for (const row of rows) {
        if (!row.tanggal) continue
        // Normalize ke YYYY-MM (row.tanggal bisa Date object atau string ISO)
        const t = String(row.tanggal).slice(0, 7)
        if (/^\d{4}-\d{2}$/.test(t)) periodSet.add(t)
      }
      aggregatePeriods = Array.from(periodSet)
      for (const p of aggregatePeriods) {
        const { error: aggErr } = await supabase
          .rpc('fn_aggregate_income', { p_outlet_id: outletId, p_periode: p })
        if (aggErr) {
          console.error(`[upload] fn_aggregate_income(${p}) gagal:`, aggErr.message)
          aggregateErrors.push(`${p}: ${aggErr.message}`)
        } else {
          console.log(`[upload] fn_aggregate_income(${p}) ok`)
        }
      }
    }

    const { error: logError } = await supabase.from('upload_logs').insert({
      kurir_id: kurirData.id,
      outlet_id: outletId,
      filename: file.name,
      periode,
      total_rows: totalRows,
      success_rows: successRows,
      error_rows: totalRows - successRows + errors.length,
      errors: errors.length > 0 ? errors : null,
    })

    if (logError) console.error('LOG ERROR:', JSON.stringify(logError))

    return NextResponse.json({
      success: true,
      totalRows,
      successRows,
      errorRows: errors.length,
      errors: errors.slice(0, 10),
      duplikat: duplikatList,
      duplikatCount: duplikatList.length,
      // ✅ tambahan info auto-aggregate income
      aggregatedPeriods: aggregatePeriods,
      aggregateErrors: aggregateErrors.length > 0 ? aggregateErrors : undefined,
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}