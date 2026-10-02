/**
 * src/lib/format/currency.ts
 *
 * Helper terpusat untuk format nominal mata uang IDR.
 *
 * 4 formatter sebelumnya tersebar di banyak file (fmt, fmtFull, fmtRp, fmtRpFormal)
 * menyebabkan inkonsistensi tampilan. Sekarang semua module pakai helper ini.
 */

/**
 * Format singkat (abbreviated): cocok untuk chart axis, KPI value ringkas.
 * Contoh: 1500000 → "Rp 1.5jt", 2500000000 → "Rp 2.5M", 50000 → "Rp 50rb", 500 → "Rp 500"
 */
export function formatCurrencyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n) || n === 0) return 'Rp 0'
  const sign = n < 0 ? '-Rp ' : 'Rp '
  const abs = Math.abs(n)

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000
    const str = val >= 10 || val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')
    return `${sign}${str}M`
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000
    const str = val >= 10 || val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')
    return `${sign}${str}jt`
  }
  if (abs >= 1_000) {
    const val = abs / 1_000
    const str = val >= 10 || val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')
    return `${sign}${str}rb`
  }
  return `${sign}${Math.round(abs)}`
}

/**
 * Format full Indonesia: "Rp 1.500.000" dengan separator titik sesuai standar.
 * Negatif → "−Rp 400.000" (unicode minus, bukan hyphen). Cocok untuk tabel utama.
 */
export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0'
  if (n === 0) return 'Rp 0'
  const formatted = Math.round(Math.abs(n)).toLocaleString('id-ID')
  return n < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`
}

/**
 * Format akuntansi: "Rp. 1.500.000,-" (konsisten dgn modul Akunting).
 * Negatif → "−Rp. 1.500.000,-". Cocok untuk laporan laba-rugi.
 */
export function formatCurrencyAccounting(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rp. 0,-'
  if (n === 0) return 'Rp. 0,-'
  const formatted = Math.round(Math.abs(n)).toLocaleString('id-ID')
  return n < 0 ? `-Rp. ${formatted},-` : `Rp. ${formatted},-`
}

/**
 * Format dengan label unit (untuk tabel seperti Top 3 Komoditas).
 * @deprecated Gunakan formatCurrency() + unit text terpisah
 */
export function formatWithSign(n: number): string {
  return formatCurrency(n)
}

/**
 * Konversi angka rupiah ke kata-kata (Terbilang bahasa Indonesia).
 * Berguna untuk konfirmasi input nominal akuntansi agar tidak salah digit nol.
 * Contoh: 600000 -> "Enam ratus ribu rupiah"
 */
export function terbilang(n: number | null | undefined): string {
  if (!n || n <= 0 || isNaN(n)) return ''
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  function rekursif(x: number): string {
    if (x < 12) return satuan[x]
    if (x < 20) return rekursif(x - 10) + ' belas'
    if (x < 100) return rekursif(Math.floor(x / 10)) + ' puluh ' + rekursif(x % 10)
    if (x < 200) return 'seratus ' + rekursif(x - 100)
    if (x < 1000) return rekursif(Math.floor(x / 100)) + ' ratus ' + rekursif(x % 100)
    if (x < 2000) return 'seribu ' + rekursif(x - 1000)
    if (x < 1000000) return rekursif(Math.floor(x / 1000)) + ' ribu ' + rekursif(x % 1000)
    if (x < 1000000000) return rekursif(Math.floor(x / 1000000)) + ' juta ' + rekursif(x % 1000000)
    if (x < 1000000000000) return rekursif(Math.floor(x / 1000000000)) + ' milyar ' + rekursif(x % 1000000000)
    return rekursif(Math.floor(x / 1000000000000)) + ' triliun ' + rekursif(x % 1000000000000)
  }
  const hasil = rekursif(Math.floor(n)).replace(/\s+/g, ' ').trim()
  return hasil ? hasil.charAt(0).toUpperCase() + hasil.slice(1) + ' rupiah' : ''
}

