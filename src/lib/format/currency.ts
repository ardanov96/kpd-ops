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
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0'
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`
  return `Rp ${n}`
}

/**
 * Format full Indonesia: "Rp 1.500.000" dengan separator titik sesuai standar.
 * Negatif → "−Rp 400.000" (unicode minus, bukan hyphen). Cocok untuk tabel utama.
 */
export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0'
  if (n === 0) return 'Rp 0'
  const formatted = Math.round(Math.abs(n)).toLocaleString('id-ID')
  return n < 0 ? `−Rp ${formatted}` : `Rp ${formatted}`
}

/**
 * Format akuntansi: "Rp. 1.500.000,-" (konsisten dgn modul Akunting).
 * Negatif → "−Rp. 1.500.000,-". Cocok untuk laporan laba-rugi.
 */
export function formatCurrencyAccounting(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rp. 0,-'
  if (n === 0) return 'Rp. 0,-'
  const formatted = Math.round(Math.abs(n)).toLocaleString('id-ID')
  return n < 0 ? `−Rp. ${formatted},-` : `Rp. ${formatted},-`
}

/**
 * Format dengan label unit (untuk tabel seperti Top 3 Komoditas).
 * @deprecated Gunakan formatCurrency() + unit text terpisah
 */
export function formatWithSign(n: number): string {
  return formatCurrency(n)
}
