import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periode = searchParams.get('periode')

    let res
    if (periode) {
      res = await query('SELECT * FROM v_summary_bulanan WHERE periode = $1 ORDER BY periode DESC', [periode])
    } else {
      res = await query('SELECT * FROM v_summary_bulanan ORDER BY periode DESC')
    }

    return NextResponse.json(res.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch summary' }, { status: 500 })
  }
}
