import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: upsert config pajak per outlet (NPWP, nama WP, PKP, form_spt)
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, npwp, nama_wp, pkp, metode_pph, form_spt, omzet_tahunan } = body

  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })

  // Validasi NPWP format (15 digit, opsional)
  if (npwp !== null && npwp !== undefined && npwp !== '') {
    const cleaned = String(npwp).replace(/[.\- ]/g, '')
    if (!/^\d{15}$/.test(cleaned)) {
      return NextResponse.json(
        { error: 'NPWP harus 15 digit angka (format: 00.000.000.0-000.000)' },
        { status: 400 }
      )
    }
  }

  // Validasi form_spt
  if (form_spt && !['1770S3', '1770S', '1771'].includes(form_spt)) {
    return NextResponse.json({ error: 'form_spt tidak valid' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    outlet_id,
    updated_at: new Date().toISOString(),
  }
  if (npwp !== undefined) payload.npwp = npwp || null
  if (nama_wp !== undefined) payload.nama_wp = nama_wp || null
  if (typeof pkp === 'boolean') payload.pkp = pkp
  if (metode_pph) payload.metode_pph = metode_pph
  if (form_spt) payload.form_spt = form_spt
  if (omzet_tahunan !== undefined) payload.omzet_tahunan = Number(omzet_tahunan) || 0

  const { data, error } = await supabase
    .from('pajak_config')
    .upsert(payload, { onConflict: 'outlet_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET: ambil config pajak per outlet
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')

  if (!outletId) {
    return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outletId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || { outlet_id: outletId, npwp: null, nama_wp: null, pkp: false, form_spt: '1770S3' })
}
