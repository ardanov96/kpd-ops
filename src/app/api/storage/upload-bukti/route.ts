/**
 * POST /api/storage/upload-bukti
 * Server-side upload bukti SSP PPh Final ke bucket `bukti-pajak`.
 * Owner-only (NPWP & SSP data sensitif — sesuai D-006).
 *
 * Multipart form:
 *   - file: File (JPG/PNG/PDF, max 5MB) — wajib
 *   - outletId: string — wajib
 *   - refId?: string (pajak_rekap ID, opsional)
 *   - subfolder?: string (default: YYYY-MM saat ini)
 *
 * Response 200:
 *   { ok: true, path, publicUrl, originalName, size, mimeType }
 */

import { NextRequest, NextResponse } from 'next/server'
import { uploadBuktiPajak } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — owner only (data SSP sangat sensitif)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Akses ditolak — owner only' }, { status: 403 })
    }

    // 2. Parse form
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

    let subfolder = subfolderRaw
    if (!subfolder) {
      const now = new Date()
      subfolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    // 3. Upload via helper
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
      return NextResponse.json({ error: 'Upload gagal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...result.data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error', code: 'UPLOAD_FAILED' },
      { status: 500 }
    )
  }
}
