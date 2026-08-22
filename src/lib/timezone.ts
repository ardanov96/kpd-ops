/**
 * src/lib/timezone.ts
 *
 * Helper untuk konsistensi timezone Asia/Makassar (WIB, UTC+8).
 *
 * Sprint 6 - Fix ISU #33: Sebelumnya `new Date()` di berbagai page
 * pakai UTC, padahal owner di Indonesia (WIB). Jam 01:00 WIB di Indonesia
 * = tanggal "kemarin" di UTC → currentPeriode jadi bulan/salah.
 *
 * Helper ini memastikan semua tanggal & bulan konsisten pakai timezone
 * Asia/Makassar (WIB).
 *
 * Usage:
 *   import { getCurrentPeriodeWIB, getTodayWIB, formatDateWIB } from '@/lib/timezone'
 */

const WIB_OFFSET_HOURS = 8 // Asia/Makassar = UTC+8

/**
 * Get current Date object shifted to WIB (UTC+8) wall-clock time.
 * Used internally so that .getFullYear(), .getMonth(), .getDate()
 * return WIB values regardless of server timezone.
 */
export function nowWIB(): Date {
  const now = new Date()
  // Shift UTC to WIB by adding 8 hours worth of ms
  const wibMs = now.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000
  return new Date(wibMs)
}

/**
 * Get today date as 'YYYY-MM-DD' in WIB.
 */
export function getTodayWIB(): string {
  const d = nowWIB()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Get current periode (YYYY-MM) in WIB.
 * Ini yang dipakai di seluruh dashboard untuk "bulan ini".
 */
export function getCurrentPeriodeWIB(): string {
  const d = nowWIB()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

/**
 * Get current year in WIB.
 */
export function getCurrentYearWIB(): number {
  return nowWIB().getUTCFullYear()
}

/**
 * Generate list of N periode terakhir (untuk chart/trend).
 * @param count jumlah periode (default 6)
 * @returns Array 'YYYY-MM' dari yang terlama ke terbaru
 */
export function getLastNPeriodesWIB(count: number = 6): string[] {
  const result: string[] = []
  const d = nowWIB()
  for (let i = count - 1; i >= 0; i--) {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() - i
    let actualYear = year
    let actualMonth = month
    if (actualMonth < 0) {
      actualYear -= 1
      actualMonth += 12
    }
    const mm = String(actualMonth + 1).padStart(2, '0')
    result.push(`${actualYear}-${mm}`)
  }
  return result
}

/**
 * Format Date ke 'YYYY-MM-DD' di timezone WIB.
 */
export function formatDateWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  // Shift to WIB
  const wibMs = d.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000
  const wib = new Date(wibMs)
  const yyyy = wib.getUTCFullYear()
  const mm = String(wib.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(wib.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Parse 'YYYY-MM' atau 'YYYY-MM-DD' ke Date object di WIB timezone.
 * Berguna untuk display tanggal yang konsisten.
 */
export function parseDateWIB(dateStr: string): Date {
  // Assume dateStr is 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return d
  // Shift to WIB
  return new Date(d.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000)
}