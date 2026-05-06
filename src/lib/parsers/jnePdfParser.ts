// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

function parseDate(s: string): string | null {
  const m = s.match(/(\d{2})-([A-Z]{3})-?(\d{4})/)
  if (!m) return null
  const month = MONTHS[m[2]]
  return month ? `${m[3]}-${month}-${m[1]}` : null
}

function parseNum(s: string): number {
  return parseFloat((s || '0').replace(/,/g, '')) || 0
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

export async function parseJnePdf(buffer: Buffer): Promise<{
  rows: JnePLRow[]
  totalRows: number
  errors: string[]
  periode: string | null
}> {
  const data = await pdfParse(buffer)
  const text: string = data.text

  const rows: JnePLRow[] = []
  const errors: string[] = []

  // Deteksi periode dari header PDF
  const periodeMatch = text.match(/Periode\s*:\s*(\d{2}-[A-Z]{3}-\d{4})\s*s\/d\s*(\d{2}-[A-Z]{3}-\d{4})/)
  let periode: string | null = null
  if (periodeMatch) {
    const tgl = parseDate(periodeMatch[2])
    if (tgl) periode = tgl.slice(0, 7) // YYYY-MM
  }

  // Normalisasi text: join lines, collapse whitespace
  const normalized = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ')

  // Pattern: tanggal PL/xx/xxxxxxx diikuti deretan angka
  // Format: DD-MONNYYYY PL/xx/xxxxxxxxx num num num num num int num num num num num int int num ...
  const rowPattern = /(\d{2}-[A-Z]{3}-?\d{4})\s+(PL\/\d+\/\d+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(\d+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(\d+)\s+(\d+)\s+([\d,]+\.?\d*)/g

  let match
  while ((match = rowPattern.exec(normalized)) !== null) {
    try {
      // Cari date_paid dan outstanding setelah match
      const after = normalized.slice(match.index + match[0].length, match.index + match[0].length + 300)
      const paidMatch = after.match(/(\d{2}-[A-Z]{3}-?\d{4})\s+([\d,]+\.?\d*)/)
      
      // Cari outstanding (angka terakhir sebelum baris berikutnya / PL berikutnya)
      let outstanding = 0
      let datePaid: string | null = null
      if (paidMatch) {
        datePaid = parseDate(paidMatch[1])
        outstanding = parseNum(paidMatch[2])
      } else {
        // Belum dibayar — outstanding = total_net
        const outstandingMatch = after.match(/([\d,]+\.?\d*)\s*$/)
        if (outstandingMatch) outstanding = parseNum(outstandingMatch[1])
      }

      rows.push({
        tanggal: parseDate(match[1]),
        nomor_pl: match[2],
        amount: parseNum(match[3]),
        publish_rate: parseNum(match[4]),
        // match[5,6,7] = surcharge, ?, ?
        cnote_count: parseInt(match[8]) || 0,
        insurance: parseNum(match[9]),
        vat_amount: parseNum(match[10]),
        discount: parseNum(match[11]),
        disc_others: parseNum(match[12]),
        total_net: parseNum(match[13]),
        // match[14] = cnote ulang
        coly: parseInt(match[15]) || 0,
        weight: parseNum(match[16]),
        date_paid: datePaid,
        outstanding,
      })
    } catch (err) {
      errors.push(`PL ${match[2]}: ${String(err)}`)
    }
  }

  return { rows, totalRows: rows.length, errors, periode }
}