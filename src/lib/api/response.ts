/**
 * src/lib/api/response.ts
 *
 * Helper untuk standardisasi response API.
 * - apiOk: response sukses (default 200)
 * - apiError: response error + log ke server side (JANGAN bocor detail DB ke client)
 *
 * Sprint 6 - Fix ISU #16: Sebelumnya error.message dari Supabase langsung
 * dikembalikan ke client, yang bisa bocor info schema DB.
 */

import { NextResponse } from 'next/server'

/**
 * Standard success response.
 */
export function apiOk<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * Standard error response.
 *
 * @param err Error asli (unknown, biasanya dari Supabase / fetch / dll)
 * @param status HTTP status code (default 500)
 * @param context Konteks tambahan untuk server-side log (tidak dikirim ke client)
 * @param safeMessage Pesan error yang AMAN untuk dikirim ke client (opsional)
 *
 * Best practice:
 *   - Log err?.message ke console (server-side) untuk debugging
 *   - Return generic/safe message ke client (jangan bocor schema/credential)
 */
export function apiError(
  err: unknown,
  status: number = 500,
  context?: string,
  safeMessage?: string
): NextResponse {
  // Server-side log untuk debugging (tidak terlihat di client browser)
  const detail = err instanceof Error ? err.message : String(err)
  const code = (err as any)?.code
  const hint = (err as any)?.hint
  const logMsg = `[API Error] ${context || ''} ${detail} ${code ? `(code: ${code})` : ''} ${hint ? `(hint: ${hint})` : ''}`
  console.error(logMsg)

  // Tentukan pesan aman untuk client
  let clientMessage = safeMessage || 'Terjadi kesalahan pada server. Silakan coba lagi.'

  // Beberapa error umum yang boleh ditampilkan ke client (tidak bocor info sensitif)
  if (status === 400 && detail && !safeMessage) {
    // Untuk 400, biasanya user-facing error (validation), tampilkan apa adanya
    // selama tidak mengandung "supabase" / "postgres" / "RLS"
    if (!/supabase|postgres|RLS|relation|column/i.test(detail)) {
      clientMessage = detail
    }
  } else if (status === 401) {
    clientMessage = safeMessage || 'Tidak terautentikasi. Silakan login ulang.'
  } else if (status === 403) {
    clientMessage = safeMessage || 'Akses ditolak. Anda tidak punya izin untuk aksi ini.'
  } else if (status === 404) {
    clientMessage = safeMessage || 'Data tidak ditemukan.'
  } else if (status === 409) {
    clientMessage = safeMessage || 'Data konflik. Mungkin sudah ada atau duplikat.'
  } else if (status === 413) {
    clientMessage = safeMessage || 'File terlalu besar.'
  } else if (status === 429) {
    clientMessage = safeMessage || 'Terlalu banyak request. Coba lagi nanti.'
  }

  return NextResponse.json({ error: clientMessage }, { status })
}

/**
 * Helper untuk validation error (400 Bad Request).
 * Pakai seperti: return apiBadRequest('Field X wajib diisi')
 */
export function apiBadRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Helper untuk not-found (404).
 */
export function apiNotFound(message: string = 'Data tidak ditemukan'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * Helper untuk validation error terstruktur (multiple fields).
 */
export function apiValidationError(errors: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      error: 'Validasi gagal',
      fields: errors,
    },
    { status: 400 }
  )
}