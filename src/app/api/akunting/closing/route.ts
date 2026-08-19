import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: tutup buku & lock periode (idempotent — bisa re-run untuk hitung ulang)
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, periode } = body

  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return NextResponse.json({ error: 'periode harus YYYY-MM' }, { status: 400 })
  }

  // Panggil function fn_closing_periode (idempotent)
  // Untuk MVP, kita pakai null closed_by (owner tidak login di Server Component)
  const { error: fnErr } = await supabase
    .rpc('fn_closing_periode', { p_outlet_id: outlet_id, p_periode: periode, p_closed_by: null })

  if (fnErr) return NextResponse.json({ error: fnErr.message }, { status: 500 })

  // Ambil hasil closing
  const { data: closing, error: errCl } = await supabase
    .from('periode_closing')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .single()

  if (errCl) return NextResponse.json({ error: errCl.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    closing,
    laba: closing?.laba,
    total_income: closing?.total_income,
    total_expense: closing?.total_expense,
  })
}
