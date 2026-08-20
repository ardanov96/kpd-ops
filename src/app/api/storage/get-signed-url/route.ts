/**
 * POST /api/storage/get-signed-url
 * Generate signed URL untuk file yang sudah ada di bucket.
 * Owner-only (data SSP & nota expense sensitif).
 *
 * Body JSON:
 *   - bucket: 'nota-expense' | 'bukti-pajak'
 *   - path: string (path dalam bucket)
 *   - expiry?: number (detik, default 3600)
 *
 * Response:
 *   { url: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, BUCKET_NOTA } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_BUCKETS = [BUCKET_NOTA, 'bukti-pajak'] as const

export async function POST(req: NextRequest) {
  try {
    // 1. Auth (owner only — data SSP/nota sensitif)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Akses ditolak — owner only' }, { status: 403 })
    }

    // 2. Parse body
    const body = await req.json()
    const { bucket, path, expiry } = body

    if (!bucket || !VALID_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: `bucket harus salah satu dari: ${VALID_BUCKETS.join(', ')}` },
        { status: 400 }
      )
    }
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'path wajib diisi' }, { status: 400 })
    }

    // 3. Generate signed URL
    const exp = Number(expiry) > 0 ? Number(expiry) : 3600
    const result = await getSignedUrl(
      bucket as typeof VALID_BUCKETS[number],
      path,
      exp
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ url: result.url, expiry: exp })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
