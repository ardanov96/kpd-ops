import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: list rekap pajak per outlet
// Query: outlet_id (wajib), tahun (opsional, YYYY), status (opsional, BELUM/LUNAS/BEAS)
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const outletId = searchParams.get('outlet_id')
  const tahun = searchParams.get('tahun')
  const status = searchParams.get('status')

  if (!outletId) {
    return NextResponse.json({ error: 'outlet_id wajib' }, { status: 400 })
  }

  let query = supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outletId)
    .order('periode', { ascending: false })

  if (tahun) {
    // Filter by tahun (4 char pertama periode 'YYYY-MM')
    query = query.like('periode', `${tahun}-%`)
  }
  if (status) {
    query = query.eq('status_bayar', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
