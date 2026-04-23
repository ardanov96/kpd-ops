import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseXLSX } from '@/lib/parsers/xlsxParser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kurirKode = formData.get('kurir') as string
    const outletId = formData.get('outlet_id') as string
    const periode = formData.get('periode') as string

    if (!file || !kurirKode || !outletId) {
      return NextResponse.json({ error: 'File, kurir, dan outlet wajib diisi' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Ambil kurir_id dari kode
    const { data: kurirData, error: kurirErr } = await supabase
      .from('kurir')
      .select('id')
      .eq('kode', kurirKode.toUpperCase())
      .single()

    if (kurirErr || !kurirData) {
      return NextResponse.json({ error: `Kurir "${kurirKode}" tidak ditemukan` }, { status: 400 })
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, errors, totalRows } = parseXLSX(buffer, kurirKode)

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada baris valid yang bisa diimport',
        details: errors,
      }, { status: 400 })
    }

    // Siapkan data untuk insert
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

    // Upsert (update jika STT sudah ada, insert jika baru)
    const { data: inserted, error: insertErr } = await supabase
      .from('transaksi')
      .upsert(insertData, { onConflict: 'kurir_id,nomor_stt', ignoreDuplicates: false })
      .select('id')

    const successRows = inserted?.length || 0
    const errorRows = totalRows - successRows

    // Simpan log
    await supabase.from('upload_logs').insert({
      outlet_id: outletId,
      kurir_id: kurirData.id,
      filename: file.name,
      periode,
      total_rows: totalRows,
      success_rows: successRows,
      error_rows: errorRows + errors.length,
      errors: errors.length > 0 ? errors : null,
    })

    return NextResponse.json({
      success: true,
      totalRows,
      successRows,
      errorRows: errors.length,
      errors: errors.slice(0, 10), // max 10 errors dikirim ke client
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
