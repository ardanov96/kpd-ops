/**
 * GET /api/akunting/export?type=laba-rugi&periode=YYYY-MM[&outlet_id=...]
 * GET /api/akunting/export?type=transaksi&periode=YYYY-MM[&outlet_id=...]
 *
 * Server-side export endpoint. Mengembalikan file xlsx langsung di-stream
 * dari Supabase. Berguna untuk export besar (chunked, tidak block browser).
 *
 * Query params:
 *   - type: 'laba-rugi' | 'neraca' | 'transaksi'
 *   - periode: 'YYYY-MM' (default: bulan ini)
 *   - outlet_id: uuid (optional, default: outlet pertama owner)
 *
 * Response: file attachment XLSX.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { exportToXlsxBuffer, type XlsxSheet } from '@/lib/export/xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'laba-rugi'
    const periode = searchParams.get('periode') || defaultPeriode()
    const outletIdParam = searchParams.get('outlet_id')

    if (!['laba-rugi', 'neraca', 'transaksi'].includes(type)) {
      return NextResponse.json(
        { error: `type harus salah satu dari: laba-rugi, neraca, transaksi` },
        { status: 400 }
      )
    }
    if (!/^\d{4}-\d{2}$/.test(periode)) {
      return NextResponse.json({ error: 'periode harus YYYY-MM' }, { status: 400 })
    }

    // ✅ Pakai helper (Fix #2): outlet_id dari profile user, fallback outlet paling lama
    let outletId = outletIdParam
    if (!outletId) {
      const outlet = await getActiveOutlet(supabase)
      outletId = outlet?.id || null
    }
    if (!outletId) {
      return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 404 })
    }

    const [year, month] = periode.split('-')

    let sheets: XlsxSheet[] = []
    let filename = ''

    if (type === 'laba-rugi') {
      filename = `Laporan_Laba_Rugi_${periode}.xlsx`

      const { data: lr } = await supabase
        .from('v_laba_rugi')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('periode', periode)
        .maybeSingle()

      const { data: breakdown } = await supabase
        .from('v_keuangan_per_kategori')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('periode', periode)
        .order('kategori_kode')

      const lrRows = [
        { section: 'INCOME', kode: '', nama: 'Total Income', nominal: Number(lr?.total_income || 0) },
        ...(breakdown || []).map((b) => ({
          section: '',
          kode: b.kategori_kode,
          nama: b.kategori_nama,
          nominal: Number(b.nominal_income),
        })),
        { section: 'EXPENSE', kode: '', nama: 'Total Expense', nominal: Number(lr?.total_expense || 0) },
        ...(breakdown || []).map((b) => ({
          section: '',
          kode: b.kategori_kode,
          nama: b.kategori_nama,
          nominal: Number(b.nominal_expense),
        })),
        { section: '', kode: '', nama: 'LABA KOTOR', nominal: Number(lr?.laba_kotor || 0) },
      ]
      sheets = [
        {
          name: 'Laba-Rugi',
          title: `LAPORAN LABA-RUGI - ${periode}`,
          columns: [
            { header: 'Section', key: 'section', width: 16 },
            { header: 'Kode Akun', key: 'kode', width: 12 },
            { header: 'Nama Akun', key: 'nama', width: 36 },
            { header: 'Nominal (Rp)', key: 'nominal', width: 18, format: 'currency' as const },
          ],
          rows: lrRows,
          footerNote: `Server-side export via /api/akunting/export?tahun=${year}&bulan=${month}`,
        },
      ]
    } else if (type === 'neraca') {
      filename = `Laporan_Neraca_${periode}.xlsx`

      const { data: neraca } = await supabase
        .from('v_neraca')
        .select('*')
        .eq('outlet_id', outletId)
        .maybeSingle()

      if (!neraca) {
        return NextResponse.json({ error: 'Data neraca tidak ditemukan' }, { status: 404 })
      }

      sheets = [
        {
          name: 'Neraca',
          title: 'LAPORAN NERACA (Snapshot)',
          columns: [
            { header: 'Akun', key: 'akun', width: 32 },
            { header: 'Nilai (Rp)', key: 'nilai', width: 18, format: 'currency' as const },
          ],
          rows: [
            { akun: 'Kas', nilai: Number(neraca.total_aset_kas) },
            { akun: 'Total Aset', nilai: Number(neraca.total_aset) },
            { akun: '', nilai: '' as any },
            { akun: 'Modal Pemilik', nilai: Number(neraca.total_modal_pemilik) },
            { akun: 'Laba Ditahan', nilai: Number(neraca.total_laba_ditahan) },
            { akun: 'Total Equity', nilai: Number(neraca.total_equity) },
            { akun: '', nilai: '' as any },
            { akun: 'Selisih (harus 0)', nilai: Number(neraca.selisih) },
          ],
        },
      ]
    } else if (type === 'transaksi') {
      filename = `Daftar_Transaksi_${periode}.xlsx`

      const startDate = `${periode}-01`
      const nextMonth = Number(month) === 12 ? '01' : String(Number(month) + 1).padStart(2, '0')
      const nextYear = Number(month) === 12 ? String(Number(year) + 1) : year
      const endDate = `${nextYear}-${nextMonth}-01`

      const { data: trx } = await supabase
        .from('transaksi_keuangan')
        .select('*, kategori:kategori_akun(kode, nama)')
        .eq('outlet_id', outletId)
        .gte('tanggal', startDate)
        .lt('tanggal', endDate)
        .order('tanggal', { ascending: false })

      sheets = [
        {
          name: 'Transaksi',
          title: `DAFTAR TRANSAKSI - ${periode}`,
          columns: [
            { header: 'Tanggal', key: 'tanggal', width: 14 },
            { header: 'Tipe', key: 'tipe', width: 12 },
            { header: 'Kode Akun', key: 'kode', width: 12 },
            { header: 'Nama Akun', key: 'kategori_nama', width: 32 },
            { header: 'Metode', key: 'metode', width: 12 },
            { header: 'Nominal (Rp)', key: 'nominal', width: 18, format: 'currency' as const },
            { header: 'Sumber', key: 'sumber', width: 14 },
            { header: 'Keterangan', key: 'keterangan', width: 32 },
          ],
          rows: (trx || []).map((t: any) => ({
            tanggal: t.tanggal,
            tipe: t.tipe,
            kode: t.kategori?.kode || '',
            kategori_nama: t.kategori?.nama || '',
            metode: t.metode || '-',
            nominal: Number(t.nominal),
            sumber: t.sumber || '-',
            keterangan: t.keterangan || '-',
          })),
        },
      ]
    }

    const buf = exportToXlsxBuffer({
      filename,
      sheets,
      companyName: 'Ekspedisi Dashboard',
    })

    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.byteLength || (buf as ArrayBuffer).byteLength),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

function defaultPeriode(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
