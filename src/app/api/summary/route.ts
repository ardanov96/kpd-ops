import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const periode = searchParams.get('periode')

  let query = supabase.from('v_summary_bulanan').select('*')
  if (periode) query = query.eq('periode', periode)

  const { data, error } = await query.order('periode', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
