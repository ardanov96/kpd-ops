import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: set status LUNAS + tanggal_bayar + bukti_url (URL paste manual, upload UI Sprint 4)
// Body: { id, status_bayar: 'LUNAS'|'BELUM'|'BEAS', tanggal_bayar, bukti_url, catatan }
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, status_bayar, tanggal_bayar, bukti_url, catatan } = body

  if (!id) return NextResponse.json({ error: 'id rekap wajib' }, { status: 400 })
  if (!['BELUM', 'LUNAS', 'BEAS'].includes(status_bayar)) {
    return NextResponse.json({ error: 'status_bayar tidak valid' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { status_bayar }
  if (tanggal_bayar !== undefined) payload.tanggal_bayar = tanggal_bayar || null
  if (bukti_url !== undefined) payload.bukti_url = bukti_url || null
  if (catatan !== undefined) payload.catatan = catatan || null

  const { data, error } = await supabase
    .from('pajak_rekap')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
