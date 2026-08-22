/**
 * POST /api/storage/upload-bukti
 * Server-side upload bukti SSP PPh ke bucket `bukti-pajak`.
 * Owner-only (sesuai D-006: data SSP/NPWP sangat sensitif).
 *
 * Multipart form:
 *   - file: File (JPG/PNG/WebP/PDF, max 5MB) — wajib
 *   - outletId: string — wajib
 *   - refId?: string (pajak_rekap ID, opsional)
 *   - subfolder?: string (default: YYYY-MM saat ini)
 *
 * Response 200:
 *   { ok: true, path, publicUrl, originalName, size, mimeType }
 */

import { NextRequest, NextResponse } from 'next/server'
import { uploadBuktiPajak } from '@/lib/storage'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiError, apiOk, apiBadRequest } from '@/lib/api/response'
import { getCurrentPeriodeWIB } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // Buffer diperlukan untuk upload

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiBadRequest('Body harus FormData')
  }

  const file = formData.get('file') as File | null
  const outletId = formData.get('outletId') as string | null
  const refId = formData.get('refId') as string | null
  const subfolderRaw = formData.get('subfolder') as string | null

  if (!outletId) return apiBadRequest('outletId wajib diisi')
  if (!file) return apiBadRequest('file wajib diisi')

  const subfolder = subfolderRaw || getCurrentPeriodeWIB()

  const result = await uploadBuktiPajak({
    outletId,
    refId: refId || undefined,
    subfolder,
    file,
  })

  if (result.error) {
    const status = result.error.code === 'FILE_TOO_LARGE' ? 413 : 400
    return NextResponse.json(result, { status })
  }
  if (!result.data) {
    return apiError(new Error('Upload result kosong'), 500, '[POST storage/upload-bukti]', 'Upload gagal')
  }

  return apiOk({ ok: true, ...result.data })
}