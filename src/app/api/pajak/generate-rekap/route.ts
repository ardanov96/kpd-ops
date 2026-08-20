import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: manual trigger generate PPh Final 0,5% rekap
// Body: { outlet_id, periode } -> panggil fn_generate_pph_final_rekap
// Idempotent: aman dipanggil berulang
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { outlet_id, periode } = body

  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return NextResponse.json({ error: 'periode harus YYYY-MM' }, { status: 400 })
  }

  // Panggil function PG (idempotent — unique outlet+periode+jenis_pajak)
  const { data, error } = await supabase
    .rpc('fn_generate_pph_final_rekap', { p_outlet_id: outlet_id, p_periode: periode })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ambil row hasil generate
  const { data: rekap, error: errRekap } = await supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .eq('jenis_pajak', 'PPH_FINAL_05')
    .maybeSingle()

  if (errRekap) return NextResponse.json({ error: errRekap.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    rpc_result: data,
    rekap,
  })
}
