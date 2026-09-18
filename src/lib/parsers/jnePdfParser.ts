// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

const MONTHS_CASE: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
}

/**
 * Parse tanggal dalam banyak format:
 * - DD-MMM-YYYY  (JNE standard, mis. 01-SEP-2024)
 * - DD-MMMYYYY  (tanpa separator, mis. 01-SEP2024)
 * - DD-MM-YYYY   (numeric month)
 * - DD/MM/YYYY   (slash separator)
 * - DD MMM YYYY  (space separator)
 * - case-insensitive (sep, Sep, SEP, agustus)
 *
 * Return YYYY-MM-DD or null.
 */
function parseDate(s: string): string | null {
  if (!s) return null
  // DD-MMM-YYYY / DD-MMMYYYY / DD-MMM YYYY
  let m = s.match(/(\d{1,2})[\s\-\/]+([A-Za-z]+)[\s\-\/]*(\d{2,4})/)
  if (m) {
    const day = m[1].padStart(2, '0')
    const monthKey = m[2].toLowerCase()
    const month = MONTHS_CASE[monthKey] || MONTHS[m[2].toUpperCase()]
    let year = m[3]
    if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year
    if (month) return `${year}-${month}-${day}`
  }
  // DD-MM-YYYY numeric
  m = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})$/)
  if (m) {
    const day = m[1].padStart(2, '0')
    const month = m[2].padStart(2, '0')
    let year = m[3]
    if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year
    return `${year}-${month}-${day}`
  }
  return null
}

/**
 * Parse angka dengan banyak format:
 * - "1.500.000"    (titik = thousand separator Indonesia)
 * - "1,500,000"    (koma = thousand separator English)
 * - "1 500 000"    (spasi = thousand separator)
 * - "1500000"      (tanpa separator)
 * - "1.5"          (decimal)
 * - "1500.50"      (decimal)
 * - "(5000)"       (negatif dalam kurung, accounting style)
 *
 * Catatan: deteksi thousand separator berdasarkan jumlah titik/koma.
 *   - "1.500.000" → 1500000 (titik = thousand)
 *   - "1.5"       → 1.5 (titik = decimal)
 *   - "1,500,000" → 1500000 (koma = thousand)
 *   - "1,5"       → 1.5 (koma = decimal)
 */
function parseNum(s: string): number {
  if (!s) return 0
  let str = s.trim()

  // Handle accounting negative: (1234) → -1234
  let negative = false
  if (str.startsWith('(') && str.endsWith(')')) {
    negative = true
    str = str.slice(1, -1)
  }

  // Extract FIRST number sequence (handle multi-number input dari match terakhir
  // yg greedy, mis. "13.78 312,561.82"). Hanya ambil angka pertama.
  const firstNum = str.match(/^-?[\d.,]+/)
  if (!firstNum) return 0
  str = firstNum[0]

  // Strip currency symbols
  str = str.replace(/Rp\.?|IDR/g, '')

  // Detect separator style: count '.' and ',' in remaining string
  const dots = (str.match(/\./g) || []).length
  const commas = (str.match(/,/g) || []).length

  if (dots === 0 && commas === 0) {
    // No separator, plain number
  } else if (dots > 0 && commas === 0) {
    // Only dots. If multiple dots = thousand separator. If single dot at end = decimal.
    if (dots > 1) str = str.replace(/\./g, '')
    // else leave as decimal point (parseFloat handles)
  } else if (dots === 0 && commas > 0) {
    if (commas > 1) str = str.replace(/,/g, '')
    // else single comma = decimal
  } else {
    // Both present: the rightmost is decimal, others are thousand separator
    const lastDot = str.lastIndexOf('.')
    const lastComma = str.lastIndexOf(',')
    const decimalIdx = Math.max(lastDot, lastComma)
    const thousandChar = decimalIdx === lastDot ? ',' : '.'
    str = str.split(thousandChar).join('')
  }

  const n = parseFloat(str)
  if (isNaN(n)) return 0
  return negative ? -n : n
}

export interface JnePLRow {
  nomor_pl: string
  tanggal: string | null
  amount: number
  publish_rate: number
  cnote_count: number
  insurance: number
  vat_amount: number
  discount: number
  disc_others: number
  total_net: number
  coly: number
  weight: number
  date_paid: string | null
  outstanding: number
}

export interface ParseResult {
  rows: JnePLRow[]
  totalRows: number
  errors: string[]
  /** Periode yg terdeteksi dari header PDF (DD-MMMYYYY s/d DD-MMMYYYY).
   *  Hanya indikatif — bukan sumber kebenaran. Konsistensi periode
   *  sekarang dijaga via to_char(tanggal, 'YYYY-MM') di view/function. */
  periodeHint: string | null
  warnings: string[]
}

/**
 * Validate PDF adalah Rekapitulasi Packing List JNE (bukan PDF sembarang).
 * Return null jika valid, atau string error message.
 */
function validateJnePdf(text: string): string | null {
  const lower = text.toLowerCase()
  // Cek minimal ada marker JNE atau Packing List
  const hasJne = /\bjne\b/i.test(lower)
  const hasPackingList = /packing[\s\-]?list/i.test(lower)
  const hasPeriode = /periode/i.test(lower)
  const hasPlNumber = /pl\/\d+\/\d+/i.test(lower)

  if (!hasPlNumber) return 'Tidak ditemukan nomor PL (format PL/xx/xxxxxxx) di PDF'
  if (!hasJne && !hasPackingList) {
    return 'PDF tidak dikenali sebagai Rekapitulasi Packing List JNE'
  }
  if (!hasPeriode) {
    return 'Tidak ditemukan header Periode di PDF'
  }
  return null
}

export async function parseJnePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer)
  const text: string = data.text || ''

  const rows: JnePLRow[] = []
  const errors: string[] = []
  const warnings: string[] = []

  // Validasi input
  const validationError = validateJnePdf(text)
  if (validationError) {
    errors.push(validationError)
    return { rows, totalRows: 0, errors, periodeHint: null, warnings }
  }

  // Deteksi periode dari header — multiple format. Hanya sbg hint,
  // bukan sumber kebenaran (konsistensi dijaga via to_char(tanggal)).
  let periodeHint: string | null = null
  const periodePatterns = [
    /Periode\s*:\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]*\d{2,4})\s*s[\/.\s]?d[\s\.]?\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]*\d{2,4})/i,
    /Period\s*:\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]*\d{2,4})\s*to\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]*\d{2,4})/i,
  ]
  for (const p of periodePatterns) {
    const m = text.match(p)
    if (m) {
      const endDate = parseDate(m[2])
      if (endDate) {
        periodeHint = endDate.slice(0, 7)
        break
      }
    }
  }

  // Normalisasi text: join lines, collapse whitespace, tapi pertahankan baris kosong
  const normalized = text.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ')

  // Row regex — handle tanggal yg wrap ke baris berikutnya (DD-MMM-\nYYYY
  // jadi DD-MMM- 2026 setelah join). `(?:-\s*)?` antara MMM dan YYYY toleransi
  // whitespace. Capture group TUNGGAL utk date supaya index mapping
  // berikutnya tetap konsisten (tidak off-by-one).
  //
  // Capture groups:
  //  1: tanggal lengkap (DD-MMM-YYYY atau DD-MMM- YYYY jika wrap)
  //  2: nomor PL (PL/xx/xxxxxxx)
  //  3: amount           4: publish_rate   5: after_vat (unused)
  //  6: surcharge? (unused)  7: packing? (unused)
  //  8: cnote_ins count (JNE insurance cnote count)
  //  9: insurance        10: vat_amount     11: discount
  //  12: disc_others     13: total_net
  //  14: cnote (total)   15: coly           16: weight
  // Pola match[16] (weight) khusus: angka dgn opsional koma/titik di tengah,
  // diakhiri whitespace atau end-of-string. Greedy `\d.,\s]+` di sini salah
  // karena akan consume digit "04" dr "04-AUG-2026" → date_paid parsing
  // gagal. Pakai pola eksplisit utk satu nomor.
  const rowPattern = /(\d{1,2}-[A-Za-z]{3}(?:-\s*)?\d{2,4})\s+(PL\/\d+\/\d+)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+(\d+)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+([\d.,\s\(\)]+?)\s+(\d+)\s+(\d+)\s+(\d[\d.,]*\d|\d)(?=\s|$)/gi

  let match
  let prevEndIndex = 0
  while ((match = rowPattern.exec(normalized)) !== null) {
    // Sanity check: pastikan tidak ada row "phantom" dari teks footer
    if (match.index < prevEndIndex) {
      warnings.push(`Row overlap terdeteksi di posisi ${match.index}`)
      continue
    }
    prevEndIndex = match.index + match[0].length

    try {
      const nomorPl = match[2]
      if (!nomorPl || !/^PL\/\d+\/\d+$/.test(nomorPl)) {
        errors.push(`Skip row dengan nomor_pl invalid: ${nomorPl}`)
        continue
      }

      const tanggal = parseDate(match[1])
      if (!tanggal) {
        errors.push(`Skip PL ${nomorPl}: tanggal '${match[1]}' tidak bisa di-parse`)
        continue
      }

      const amount = parseNum(match[3])
      const publishRate = parseNum(match[4])
      // match[8] = Cnote Ins (JNE insurance cnote count, biasanya 0/1 per row)
      // match[14] = Cnote total (TOTAL cnote untuk row ini — yg dipakai sbg cnote_count)
      const cnoteCount = parseInt(match[14]) || 0
      const insurance = parseNum(match[9])
      const vatAmount = parseNum(match[10])
      const discount = parseNum(match[11])
      const discOthers = parseNum(match[12])
      const totalNet = parseNum(match[13])
      const coly = parseInt(match[15]) || 0
      const weight = parseNum(match[16])

      // Cari date_paid + outstanding di teks setelah row.
      // Logika:
      //   - Kalau ada date pattern di 200 chars setelah row → dibayar, parse date + outstanding
      //   - Kalau TIDAK ada date pattern → belum dibayar, outstanding = total_net
      const after = normalized.slice(match.index + match[0].length, match.index + match[0].length + 250)
      let outstanding = totalNet  // default untuk "belum dibayar"
      let datePaid: string | null = null

      // Cari pola "DD-MMM-YYYY number" di 200 chars pertama (sebelum row berikutnya)
      // Batasi pencarian agar tidak capture footer/total halaman
      const nextPlMatch = after.match(/\bPL\/\d+\/\d+\b/)
      const searchLimit = nextPlMatch ? nextPlMatch.index : after.length
      const afterSlice = after.slice(0, searchLimit)

      // Handle wrapped date: "DD-MMM-\nYYYY" jadi "DD-MMM- YYYY" setelah join.
      // Regex pakai "(?:-\s*)?" antara MMM dan YYYY utk handle whitespace.
      const paidMatch = afterSlice.match(/(\d{1,2}-[A-Za-z]{3}(?:-\s*)?\d{2,4})\s+(-?[\d.,]+)/)
      if (paidMatch) {
        datePaid = parseDate(paidMatch[1])
        outstanding = parseNum(paidMatch[2])
      }

      // Sanity check: total_net harus > 0 untuk row valid
      if (totalNet <= 0 && amount <= 0) {
        errors.push(`Skip PL ${nomorPl}: amount=${amount}, total_net=${totalNet} (kemungkinan bukan data PL)`)
        continue
      }

      rows.push({
        tanggal,
        nomor_pl: nomorPl,
        amount,
        publish_rate: publishRate,
        cnote_count: cnoteCount,
        insurance,
        vat_amount: vatAmount,
        discount,
        disc_others: discOthers,
        total_net: totalNet,
        coly,
        weight,
        date_paid: datePaid,
        outstanding,
      })
    } catch (err) {
      errors.push(`PL ${match[2] || '?'}: ${String(err)}`)
    }
  }

  // Warning kalau row count jauh lebih kecil dari ekspektasi
  if (rows.length === 0) {
    warnings.push('Tidak ada row Packing List yang berhasil di-extract. Cek format PDF.')
  }

  return { rows, totalRows: rows.length, errors, periodeHint, warnings }
}
