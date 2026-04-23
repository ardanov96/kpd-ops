import { createClient } from '@/lib/supabase/server'
import OverviewClient from '@/components/dashboard/OverviewClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Ambil summary per kurir
  const { data: summary } = await supabase
    .from('v_summary_bulanan')
    .select('*')
    .order('periode', { ascending: false })

  // Ambil transaksi terbaru (30 data)
  const { data: recentTx } = await supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna), outlet:outlets(nama)')
    .order('tanggal', { ascending: false })
    .limit(30)

  // Hitung grand total
  const { data: grandTotal } = await supabase
    .from('transaksi')
    .select('total_biaya, diskon_booking, koli, status, kurir_id')

  return <OverviewClient summary={summary || []} recentTx={recentTx || []} grandTotal={grandTotal || []} />
}
