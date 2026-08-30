import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, deleteFile, BUCKET_NOTA, BUCKET_BUKTI } from '@/lib/storage'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_BUCKETS = [BUCKET_NOTA, BUCKET_BUKTI] as const

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

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

  if (_delete === true) {
    const result = await deleteFile(bucket as typeof VALID_BUCKETS[number], path)
    if (result.error) {
      return apiError(result.error, 500, '[POST storage/get-signed-url _delete]', `Gagal hapus: ${result.error}`)
    }
    return apiOk({ ok: true, deleted: path })
  }

  const exp = Number(expiry) > 0 ? Number(expiry) : 3600
  const result = await getSignedUrl(bucket as typeof VALID_BUCKETS[number], path, exp)

  if (result.error) {
    return apiError(result.error, 500, '[POST storage/get-signed-url]', 'Gagal generate signed URL')
  }
  return apiOk({ url: result.url, expiry: exp })
}