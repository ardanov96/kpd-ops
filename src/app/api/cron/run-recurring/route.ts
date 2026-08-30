import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const referer = req.headers.get('referer') || ''
    const host = req.headers.get('host') || ''
    if (!referer.includes(host)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await query('SELECT fn_run_recurring($1)', [today])

    return NextResponse.json({
      ok: true,
      count: res.rows[0]?.fn_run_recurring || 0,
      date: today,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to run recurring cron' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await query('SELECT fn_run_recurring($1)', [today])

    return NextResponse.json({
      ok: true,
      count: res.rows[0]?.fn_run_recurring || 0,
      date: today,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to run recurring cron' }, { status: 500 })
  }
}
