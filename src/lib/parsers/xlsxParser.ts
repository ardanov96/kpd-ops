import * as XLSX from 'xlsx'

export interface TransaksiRow {
  nomor_stt: string
  tanggal: string
  jenis_kiriman: string
  kota_tujuan: string
  kecamatan_tujuan: string
  nama_produk: string
  komoditas: string
  koli: number
  berat_volume: number
  berat_kotor: number
  berat_kena_biaya: number
  publish_rate: number
  shipping_surcharge: number
  forward_rate: number
  biaya_asuransi: number
  biaya_cod: number
  total_sebelum_potongan: number
  potongan: number
  total_biaya: number
  total_cod: number
  diskon_booking: number
  diskon_pickup: number
  diskon_asuransi: number
  diskon_forward_rate: number
  bm: number
  ppn: number
  pph: number
  status: string
  raw_data: Record<string, unknown>
}

// ─── LION PARCEL parser ───────────────────────────────────────────────────────
function parseLionRow(row: Record<string, unknown>): TransaksiRow {
  const n = (v: unknown) => Number(v) || 0
  const s = (v: unknown) => String(v || '').trim()

  // Tanggal dari Lion bisa berupa string "2026-03-31 10:32:09 +0000 +0000"
  const tglRaw = s(row['Tanggal Booking'])
  const tanggal = tglRaw.split(' ')[0] || tglRaw

  return {
    nomor_stt: s(row['Nomor STT']),
    tanggal,
    jenis_kiriman: s(row['Jenis Kiriman']) || 'NON-COD',
    kota_tujuan: s(row['Kota Tujuan']),
    kecamatan_tujuan: s(row['Kecamatan Tujuan']),
    nama_produk: s(row['Nama Produk']),
    komoditas: s(row['Nama Komoditas']),
    koli: n(row['Koli']),
    berat_volume: n(row['Berat Volume']),
    berat_kotor: n(row['Berat Kotor']),
    berat_kena_biaya: n(row['Berat Kena Biaya']),
    publish_rate: n(row['Publish Rate']),
    shipping_surcharge: n(row['Shipping Surcharge']),
    forward_rate: n(row['Origin Forward Rate']) + n(row['Destination Forward Rate']),
    biaya_asuransi: n(row['Biaya Asuransi']),
    biaya_cod: n(row['Biaya COD']),
    total_sebelum_potongan: n(row['Total Biaya Kirim Sebelum Potongan']),
    potongan: n(row['Potongan Harga']),
    total_biaya: n(row['Total Biaya Kirim']),
    total_cod: n(row['Total COD']),
    diskon_booking: n(row['Diskon Booking POS']),
    diskon_pickup: n(row['Diskon Pickup POS']),
    diskon_asuransi: n(row['Diskon Asuransi POS']),
    diskon_forward_rate: n(row['Diskon Forward Rate']),
    bm: n(row['BM']),
    ppn: n(row['PPN']),
    pph: n(row['PPH']),
    status: s(row['Status Terakhir']) || 'PENDING',
    raw_data: row as Record<string, unknown>,
  }
}

// ─── JNE parser (akan dilengkapi setelah dapat sample) ───────────────────────
function parseJNERow(row: Record<string, unknown>): TransaksiRow {
  const n = (v: unknown) => Number(v) || 0
  const s = (v: unknown) => String(v || '').trim()

  return {
    nomor_stt: s(row['No Resi'] || row['Nomor Resi'] || row['AWB']),
    tanggal: s(row['Tanggal'] || row['Tgl Kiriman'] || row['Booking Date']),
    jenis_kiriman: s(row['Jenis'] || 'NON-COD'),
    kota_tujuan: s(row['Kota Tujuan'] || row['Destination']),
    kecamatan_tujuan: s(row['Kecamatan Tujuan'] || ''),
    nama_produk: s(row['Layanan'] || row['Service'] || row['Produk']),
    komoditas: s(row['Isi Kiriman'] || row['Komoditas'] || ''),
    koli: n(row['Koli'] || row['Colly']),
    berat_volume: n(row['Berat Volume'] || row['Vol Weight']),
    berat_kotor: n(row['Berat Kotor'] || row['Berat']),
    berat_kena_biaya: n(row['Berat Kena Biaya'] || row['Charge Weight']),
    publish_rate: n(row['Tarif'] || row['Ongkir'] || row['Freight']),
    shipping_surcharge: 0,
    forward_rate: 0,
    biaya_asuransi: n(row['Asuransi'] || row['Insurance']),
    biaya_cod: n(row['Biaya COD'] || 0),
    total_sebelum_potongan: n(row['Total'] || row['Total Biaya']),
    potongan: n(row['Potongan'] || row['Diskon'] || 0),
    total_biaya: n(row['Total Tagihan'] || row['Grand Total'] || row['Total']),
    total_cod: n(row['Total COD'] || 0),
    diskon_booking: n(row['Diskon'] || row['Potongan'] || 0),
    diskon_pickup: 0,
    diskon_asuransi: 0,
    diskon_forward_rate: 0,
    bm: 0, ppn: 0, pph: 0,
    status: s(row['Status'] || row['Status Terakhir'] || 'PENDING'),
    raw_data: row as Record<string, unknown>,
  }
}

// ─── J&T parser (akan dilengkapi setelah dapat sample) ───────────────────────
function parseJNTRow(row: Record<string, unknown>): TransaksiRow {
  const n = (v: unknown) => Number(v) || 0
  const s = (v: unknown) => String(v || '').trim()

  return {
    nomor_stt: s(row['Waybill'] || row['No Waybill'] || row['Nomor STT']),
    tanggal: s(row['Tanggal Buat'] || row['Create Date'] || row['Tanggal']),
    jenis_kiriman: s(row['Tipe'] || 'NON-COD'),
    kota_tujuan: s(row['Kota Tujuan'] || row['Dest City']),
    kecamatan_tujuan: s(row['Kecamatan Tujuan'] || ''),
    nama_produk: s(row['Produk'] || row['Service Type'] || ''),
    komoditas: s(row['Komoditas'] || row['Item'] || ''),
    koli: n(row['Koli'] || row['Qty']),
    berat_volume: n(row['Berat Volume'] || 0),
    berat_kotor: n(row['Berat'] || row['Weight']),
    berat_kena_biaya: n(row['Berat Tagih'] || row['Charge Weight']),
    publish_rate: n(row['Ongkir'] || row['Freight']),
    shipping_surcharge: n(row['Surcharge'] || 0),
    forward_rate: 0,
    biaya_asuransi: n(row['Asuransi'] || 0),
    biaya_cod: n(row['COD Fee'] || 0),
    total_sebelum_potongan: n(row['Total'] || 0),
    potongan: n(row['Potongan'] || 0),
    total_biaya: n(row['Total Tagihan'] || row['Total'] || 0),
    total_cod: n(row['COD Amount'] || 0),
    diskon_booking: n(row['Diskon'] || 0),
    diskon_pickup: 0,
    diskon_asuransi: 0,
    diskon_forward_rate: 0,
    bm: 0, ppn: 0, pph: 0,
    status: s(row['Status'] || 'PENDING'),
    raw_data: row as Record<string, unknown>,
  }
}

// ─── WAHANA parser (akan dilengkapi setelah dapat sample) ────────────────────
function parseWahanaRow(row: Record<string, unknown>): TransaksiRow {
  const n = (v: unknown) => Number(v) || 0
  const s = (v: unknown) => String(v || '').trim()

  return {
    nomor_stt: s(row['No Resi'] || row['Nomor Resi'] || row['STT']),
    tanggal: s(row['Tanggal'] || row['Tgl'] || ''),
    jenis_kiriman: 'NON-COD',
    kota_tujuan: s(row['Tujuan'] || row['Kota Tujuan'] || ''),
    kecamatan_tujuan: '',
    nama_produk: s(row['Layanan'] || row['Service'] || ''),
    komoditas: s(row['Isi'] || row['Komoditas'] || ''),
    koli: n(row['Koli'] || 1),
    berat_volume: 0,
    berat_kotor: n(row['Berat']),
    berat_kena_biaya: n(row['Berat Tagih'] || row['Berat']),
    publish_rate: n(row['Ongkir'] || row['Tarif']),
    shipping_surcharge: 0,
    forward_rate: 0,
    biaya_asuransi: n(row['Asuransi'] || 0),
    biaya_cod: 0,
    total_sebelum_potongan: n(row['Total'] || 0),
    potongan: n(row['Diskon'] || 0),
    total_biaya: n(row['Total Tagihan'] || row['Total'] || 0),
    total_cod: 0,
    diskon_booking: n(row['Diskon'] || 0),
    diskon_pickup: 0,
    diskon_asuransi: 0,
    diskon_forward_rate: 0,
    bm: 0, ppn: 0, pph: 0,
    status: s(row['Status'] || 'PENDING'),
    raw_data: row as Record<string, unknown>,
  }
}

// ─── MAIN PARSER ─────────────────────────────────────────────────────────────
const PARSERS: Record<string, (row: Record<string, unknown>) => TransaksiRow> = {
  LION: parseLionRow,
  JNE: parseJNERow,
  JNT: parseJNTRow,
  WAHANA: parseWahanaRow,
}

export interface ParseResult {
  rows: TransaksiRow[]
  errors: Array<{ index: number; message: string }>
  totalRows: number
}

export function parseXLSX(buffer: Buffer, kurirKode: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]

  const parser = PARSERS[kurirKode.toUpperCase()]
  if (!parser) throw new Error(`Parser untuk kurir "${kurirKode}" belum tersedia`)

  const rows: TransaksiRow[] = []
  const errors: Array<{ index: number; message: string }> = []

  rawRows.forEach((raw, i) => {
    try {
      const parsed = parser(raw)
      if (!parsed.nomor_stt) {
        errors.push({ index: i + 2, message: 'Nomor STT kosong, baris dilewati' })
        return
      }
      rows.push(parsed)
    } catch (err) {
      errors.push({ index: i + 2, message: String(err) })
    }
  })

  return { rows, errors, totalRows: rawRows.length }
}
