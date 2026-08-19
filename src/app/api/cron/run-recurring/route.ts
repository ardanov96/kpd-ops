import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Cron endpoint untuk jalankan recurring transactions
// Dipanggil dari Vercel Cron (harian jam 06:00 WIB) atau manual dari UI
// Autentikasi: pakai header 'x-cron-secret' atau di-bypass jika dari same-origin
export async function POST(req: NextRequest) {
  // Optional: cek secret header untuk proteksi
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow same-origin POST tanpa secret (untuk testing manual dari UI owner)
    const referer = req.headers.get('referer') || ''
    const host = req.headers.get('host') || ''
    if (!referer.includes(host)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .rpc('fn_run_recurring', { p_target_date: new Date().toISOString().slice(0, 10) })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    count: data,                  // jumlah transaksi yang ter-generate
    date: new Date().toISOString().slice(0, 10),
  })
}

// GET juga di-izinkan agar Vercel Cron (yang default GET) bisa akses
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .rpc('fn_run_recurring', { p_target_date: new Date().toISOString().slice(0, 10) })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    count: data,
    date: new Date().toISOString().slice(0, 10),
  })
}
