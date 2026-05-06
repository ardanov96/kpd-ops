import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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

    const supabase = createAdminClient()

    const { data: kurirData, error: kurirErr } = await supabase
      .from('kurir').select('id, kode').eq('id', kurirId).single()
    if (kurirErr || !kurirData) {
      return NextResponse.json({ error: 'Ekspedisi tidak ditemukan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, totalRows, errors, periode: periodeDetected } = await parseJnePdf(buffer)

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada baris Packing List yang berhasil dibaca dari PDF',
        details: errors,
      }, { status: 400 })
    }

    const periode = periodeManual || periodeDetected || null

    // Cek duplikat
    const nomorPlList = rows.map(r => r.nomor_pl)
    const { data: existing } = await supabase
      .from('jne_packing_list')
      .select('nomor_pl')
      .eq('kurir_id', kurirData.id)
      .in('nomor_pl', nomorPlList)

    const duplikatSet = new Set(existing?.map(e => e.nomor_pl) || [])
    const duplikatList = [...duplikatSet].map(pl => ({ pl, periode: periode || '—' }))

    const insertData = rows.map(row => ({
      kurir_id: kurirData.id,
      nomor_pl: row.nomor_pl,
      tanggal: row.tanggal,
      amount: row.amount,
      publish_rate: row.publish_rate,
      cnote_count: row.cnote_count,
      insurance: row.insurance,
      vat_amount: row.vat_amount,
      discount: row.discount,
      disc_others: row.disc_others,
      total_net: row.total_net,
      coly: row.coly,
      weight: row.weight,
      date_paid: row.date_paid,
      outstanding: row.outstanding,
      periode,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('jne_packing_list')
      .upsert(insertData, { onConflict: 'kurir_id,nomor_pl', ignoreDuplicates: false })
      .select('id')

    if (insertErr) console.error('JNE INSERT ERROR:', JSON.stringify(insertErr))

    const successRows = inserted?.length || 0

    await supabase.from('upload_logs').insert({
      kurir_id: kurirData.id,
      filename: file.name,
      periode,
      total_rows: totalRows,
      success_rows: successRows,
      error_rows: totalRows - successRows + errors.length,
      errors: errors.length > 0 ? errors : null,
    })

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