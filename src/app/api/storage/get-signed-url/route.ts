/**
 * POST /api/storage/get-signed-url
 * Generate signed URL untuk file yang sudah ada di bucket.
 * Owner-only (data SSP & nota expense sensitif).
 *
 * Body JSON:
 *   - bucket: 'nota-expense' | 'bukti-pajak'
 *   - path: string (path dalam bucket)
 *   - expiry?: number (detik, default 3600)
 *   - _delete?: boolean (untuk orphan cleanup)
 *
 * Response:
 *   { url: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, deleteFile, BUCKET_NOTA, BUCKET_BUKTI } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/server'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_BUCKETS = [BUCKET_NOTA, BUCKET_BUKTI] as const

export async function POST(req: NextRequest) {
  // 1. Owner-only auth (sesuai D-006: data SSP/NPWP sensitif)
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { bucket, path, expiry, _delete } = body

  if (!bucket || !VALID_BUCKETS.includes(bucket)) {
    return apiBadRequest(`bucket harus salah satu dari: ${VALID_BUCKETS.join(', ')}`)
  }
  if (!path || typeof path !== 'string') {
    return apiBadRequest('path wajib diisi')
  }

  const adminSupabase = createAdminClient()

  // 3. Fix Bug #5: Kalau flag _delete ada → hapus file (untuk orphan cleanup)
  if (_delete === true) {
    const { error: delErr } = await adminSupabase.storage
      .from(bucket as typeof VALID_BUCKETS[number])
      .remove([path])
    if (delErr) {
      return apiError(delErr, 500, '[POST storage/get-signed-url _delete]', `Gagal hapus: ${delErr.message}`)
    }
    return apiOk({ ok: true, deleted: path })
  }

  // 4. Generate signed URL (default flow)
  const exp = Number(expiry) > 0 ? Number(expiry) : 3600
  const result = await getSignedUrl(bucket as typeof VALID_BUCKETS[number], path, exp)

  if (result.error) {
    return apiError(result.error, 500, '[POST storage/get-signed-url]', 'Gagal generate signed URL')
  }
  return apiOk({ url: result.url, expiry: exp })
}