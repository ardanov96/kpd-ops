/**
 * POST /api/storage/upload-nota
 * Server-side upload nota expense ke bucket `nota-expense`.
 *
 * Multipart form:
 *   - file: File (JPG/PNG/WebP/PDF, max 5MB) — wajib
 *   - outletId: string — wajib
 *   - refId?: string (transaksi_keuangan ID, opsional)
 *   - subfolder?: string (default: YYYY-MM saat ini)
 *
 * Response 200:
 *   { ok: true, path, publicUrl, originalName, size, mimeType }
 * Response 400/500:
 *   { error: string, code?: 'FILE_TOO_LARGE' | ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import { uploadNota } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // Buffer diperlukan untuk upload

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const file = formData.get('file') as File | null
    const outletId = formData.get('outletId') as string | null
    const refId = formData.get('refId') as string | null
    const subfolderRaw = formData.get('subfolder') as string | null

    if (!outletId) {
      return NextResponse.json({ error: 'outletId wajib diisi' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: 'file wajib diisi' }, { status: 400 })
    }

    // Default subfolder = YYYY-MM saat ini
    let subfolder = subfolderRaw
    if (!subfolder) {
      const now = new Date()
      subfolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    const result = await uploadNota({
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
      return NextResponse.json({ error: 'Upload gagal (tidak ada data)' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...result.data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error', code: 'UPLOAD_FAILED' },
      { status: 500 }
    )
  }
}
